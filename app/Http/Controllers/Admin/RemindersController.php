<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Actions\Booking\ConfirmBookingAction;
use App\Models\Booking;
use App\Models\CustomerProfile;
use App\Models\ManualMessageLog;
use App\Models\ReminderRule;
use App\Models\Setting;
use App\Services\SeoService;
use App\Services\SettingService;
use App\Support\Phone;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Schema;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Admin > Reminders. Lists tomorrow's (or today's / the week's) appointments and upcoming birthdays with a
 * WhatsApp button that opens a chat with a prepared message. Nothing is ever sent automatically: staff press
 * send in WhatsApp themselves. Each click is logged in manual_message_logs so the page can show "Sent".
 * No cron or queue worker is involved.
 */
class RemindersController extends Controller
{
    private const TZ = 'Asia/Karachi';

    public const DEFAULT_REMINDER = 'Assalam o Alaikum {name}, yeh Looks Smart Beauty Salon ki taraf se yaad dehani hai. Aap ki appointment {date} ko {time} par hai ({services}). Address: {address}. Agar waqt badalna ho to is chat mein bata dein. Shukriya!';

    public const DEFAULT_CONFIRM = 'Assalam o Alaikum {name}, aap ki Looks Smart Beauty Salon par booking {ref} ({services}) {date} ko {time} par hai. Kya hum aap ki booking confirm kar dein?';

    public const DEFAULT_BIRTHDAY = 'Salgirah mubarak {name}! Looks Smart Beauty Salon ki taraf se aap ko dili mubarakbad. Aap ka din khoobsurat guzray.';

    private function guard(Request $request): void
    {
        abort_unless($request->user()?->can('settings.manage'), 403);
    }

    private function logsReady(): bool
    {
        try {
            return Schema::hasTable('manual_message_logs');
        } catch (\Throwable) {
            return false;
        }
    }

    public function index(Request $request): InertiaResponse
    {
        $this->guard($request);

        $range = in_array($request->string('range')->value(), ['today', 'tomorrow', 'week'], true)
            ? $request->string('range')->value() : 'tomorrow';

        $shared = $this->sharedVars();
        $reminderTemplate = $this->template('reminder.template', self::DEFAULT_REMINDER);
        $birthdayTemplate = $this->template('birthday.template', self::DEFAULT_BIRTHDAY);
        $confirmTemplate = $this->template('confirm.template', self::DEFAULT_CONFIRM);
        $toConfirm = $this->toConfirm($confirmTemplate, $shared);

        return Inertia::render('Admin/Reminders', [
            'logsReady' => $this->logsReady(),
            'range' => $range,
            'shared' => $shared,
            'templates' => [
                'reminder' => $reminderTemplate,
                'birthday' => $birthdayTemplate,
                'confirm' => $confirmTemplate,
                'defaults' => ['reminder' => self::DEFAULT_REMINDER, 'birthday' => self::DEFAULT_BIRTHDAY, 'confirm' => self::DEFAULT_CONFIRM],
            ],
            'appointments' => $this->appointments($range, $reminderTemplate, $shared),
            'birthdays' => $this->birthdays($birthdayTemplate, $shared),
            'toConfirm' => $toConfirm,
            'emailRules' => $this->emailRules(),
            'scheduler' => ['last_run' => $this->schedulerLastRun(), 'url' => $this->schedulerUrl()],
            'mail' => ['mailer' => (string) config('mail.default'), 'queue' => (string) config('queue.default')],
        ]);
    }

    // --- Email rules (reminder_rules table, read by bookings:send-reminders and bookings:request-reviews) ----

    /** Events the two scheduled commands understand, with the direction each one filters on. */
    public const RULE_EVENTS = ['before_booking' => 'before', 'review_request' => 'after'];

    /** bookings:send-reminders only fires for these offsets (minutes). */
    public const BOOKING_REMINDER_OFFSETS = [120, 1440];

    private const UNIT_MINUTES = ['minutes' => 1, 'hours' => 60, 'days' => 1440];

    /** The rule's name is stored in the (otherwise unused) `template` column, so no new column is needed. */
    private function emailRules(): array
    {
        try {
            if (! Schema::hasTable('reminder_rules')) {
                return [];
            }

            return ReminderRule::query()
                ->whereIn('event', array_keys(self::RULE_EVENTS))
                ->orderBy('id')
                ->get()
                ->map(function (ReminderRule $rule) {
                    [$amount, $unit] = $this->splitOffset((int) $rule->offset_minutes);

                    return [
                        'id' => $rule->id,
                        'name' => (string) $rule->template,
                        'event' => $rule->event,
                        'amount' => $amount,
                        'unit' => $unit,
                        'is_active' => (bool) $rule->is_active,
                    ];
                })->all();
        } catch (\Throwable) {
            return [];
        }
    }

    /** @return array{0:int,1:string} the largest unit that divides the offset exactly */
    private function splitOffset(int $minutes): array
    {
        foreach (['days', 'hours'] as $unit) {
            if ($minutes >= self::UNIT_MINUTES[$unit] && $minutes % self::UNIT_MINUTES[$unit] === 0) {
                return [intdiv($minutes, self::UNIT_MINUTES[$unit]), $unit];
            }
        }

        return [$minutes, 'minutes'];
    }

    /** The full secret trigger URL, or null until a token has been generated. */
    private function schedulerUrl(): ?string
    {
        try {
            $token = (string) app(SettingService::class)->get('scheduler.token');

            return $token !== '' ? url('/scheduler/run/' . $token) : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /** Creates (or replaces) the scheduler token. Regenerating invalidates the old URL at once. */
    public function generateSchedulerToken(Request $request)
    {
        $this->guard($request);
        app(SettingService::class)->set('scheduler.token', bin2hex(random_bytes(24)), 'scheduler', true);

        return back()->with('success', 'New scheduler URL created. Update your cron job with it.');
    }

    /** ISO time of the last scheduler heartbeat, or null when it never ran (or the cache is unavailable). */
    private function schedulerLastRun(): ?string
    {
        try {
            $value = Cache::get('scheduler.heartbeat');

            return is_string($value) && $value !== '' ? $value : null;
        } catch (\Throwable) {
            return null;
        }
    }

    /** @return array<string, mixed> validated data ready for ReminderRule */
    private function validatedRule(Request $request): array
    {
        $data = $request->validate([
            'name' => ['required', 'string', 'max:100'],
            'event' => ['required', 'in:' . implode(',', array_keys(self::RULE_EVENTS))],
            'amount' => ['required', 'integer', 'min:1', 'max:100000'],
            'unit' => ['required', 'in:' . implode(',', array_keys(self::UNIT_MINUTES))],
            'is_active' => ['required', 'boolean'],
        ]);

        $minutes = (int) $data['amount'] * self::UNIT_MINUTES[$data['unit']];

        if ($data['event'] === 'before_booking' && ! in_array($minutes, self::BOOKING_REMINDER_OFFSETS, true)) {
            throw ValidationException::withMessages([
                'amount' => 'Booking reminders can only be sent 2 hours or 1 day before the appointment.',
            ]);
        }
        if ($data['event'] === 'review_request' && ($minutes < 60 || $minutes > 60 * 24 * 30)) {
            throw ValidationException::withMessages([
                'amount' => 'Review requests go out between 1 hour and 30 days after the appointment.',
            ]);
        }

        return [
            'event' => $data['event'],
            'direction' => self::RULE_EVENTS[$data['event']],
            'offset_minutes' => $minutes,
            'channels' => ['email'],
            'template' => trim(strip_tags($data['name'])),
            'is_active' => (bool) $data['is_active'],
        ];
    }

    public function storeRule(Request $request)
    {
        $this->guard($request);
        ReminderRule::create($this->validatedRule($request));

        return back()->with('success', 'Email rule created.');
    }

    public function updateRule(Request $request, ReminderRule $rule)
    {
        $this->guard($request);
        abort_unless(array_key_exists($rule->event, self::RULE_EVENTS), 404);
        $rule->update($this->validatedRule($request));

        return back()->with('success', 'Email rule saved.');
    }

    public function destroyRule(Request $request, ReminderRule $rule)
    {
        $this->guard($request);
        abort_unless(array_key_exists($rule->event, self::RULE_EVENTS), 404);
        $rule->delete();

        return back()->with('success', 'Email rule deleted.');
    }

    // --- Appointments -------------------------------------------------------------------------

    private function appointments(string $range, string $template, array $shared): array
    {
        $today = CarbonImmutable::now(self::TZ)->startOfDay();
        [$from, $to] = match ($range) {
            'today' => [$today, $today->endOfDay()],
            'week' => [$today, $today->addDays(6)->endOfDay()],
            default => [$today->addDay(), $today->addDay()->endOfDay()],
        };

        $bookings = Booking::query()
            ->with(['items.service:id,name', 'customer:id,name,phone'])
            ->whereIn('status', ['pending', 'confirmed'])
            ->whereBetween('starts_at', [$from->utc(), $to->utc()])
            ->orderBy('starts_at')
            ->limit(300)
            ->get();

        $sent = $this->latestLogs('reminder', 'booking_id', $bookings->pluck('id')->all());

        return $bookings->map(function (Booking $booking) use ($template, $shared, $sent) {
            $starts = CarbonImmutable::parse($booking->starts_at)->setTimezone(self::TZ);
            $name = $booking->customer?->name ?: ($booking->guest_name ?: 'Customer');
            $services = $booking->items->map(fn ($item) => $item->service?->name)->filter()->implode(', ');
            $phone = Phone::fromStored($booking->guest_phone ?: $booking->customer?->phone);
            $vars = ['name' => $name, 'services' => $services, 'date' => $starts->format('D j M'), 'time' => $starts->format('g:i A')];
            $message = $this->fill($template, $vars + $shared);
            $log = $sent[$booking->id] ?? null;

            return [
                'id' => $booking->id,
                'time' => $starts->format('D j M, g:i A'),
                'name' => $name,
                'phone' => $phone ? Phone::display($phone) : null,
                'wa_phone' => $phone,
                'services' => $services,
                'status' => $booking->status,
                'message' => $message,
                'vars' => $vars,
                'sent' => $log ? ['at' => $log->sent_at?->toIso8601String(), 'by' => $log->sender?->name] : null,
            ];
        })->values()->all();
    }

    // --- To confirm ----------------------------------------------------------------------------

    /** Upcoming pending bookings, so staff can ask customers who do not use email to confirm. */
    private function toConfirm(string $template, array $shared): array
    {
        $bookings = Booking::query()
            ->with(['items.service:id,name', 'customer:id,name,phone,email'])
            ->where('status', 'pending')
            ->where('starts_at', '>=', now())
            ->orderBy('starts_at')
            ->limit(300)
            ->get();

        $sent = $this->latestLogs('confirm', 'booking_id', $bookings->pluck('id')->all());

        return $bookings->map(function (Booking $booking) use ($template, $shared, $sent) {
            $starts = CarbonImmutable::parse($booking->starts_at)->setTimezone(self::TZ);
            $name = $booking->customer?->name ?: ($booking->guest_name ?: 'Customer');
            $services = $booking->items->map(fn ($item) => $item->service?->name)->filter()->implode(', ');
            $phone = Phone::fromStored($booking->guest_phone ?: $booking->customer?->phone);
            $vars = ['name' => $name, 'ref' => $booking->code, 'services' => $services, 'date' => $starts->format('D j M'), 'time' => $starts->format('g:i A')];
            $log = $sent[$booking->id] ?? null;

            return [
                'id' => $booking->id,
                'time' => $starts->format('D j M, g:i A'),
                'ref' => $booking->code,
                'name' => $name,
                'phone' => $phone ? Phone::display($phone) : null,
                'wa_phone' => $phone,
                'services' => $services,
                'source' => $booking->source ?: '—',
                'has_email' => filled($booking->guest_email) || filled($booking->customer?->email),
                'message' => $this->fill($template, $vars + $shared),
                'vars' => $vars,
                'sent' => $log ? ['at' => $log->sent_at?->toIso8601String(), 'by' => $log->sender?->name] : null,
            ];
        })->values()->all();
    }

    /** "Mark confirmed": the same confirm path as the customer's email link, recorded as done by staff. */
    public function markConfirmed(Request $request, Booking $booking, ConfirmBookingAction $action)
    {
        $this->guard($request);

        try {
            $result = $action->execute($booking, ConfirmBookingAction::VIA_STAFF, $request->user()->id);
        } catch (\Illuminate\Validation\ValidationException $e) {
            return back()->with('error', $e->getMessage());
        }

        return back()->with('success', $result === 'already' ? 'Already confirmed.' : "Booking {$booking->code} marked confirmed.");
    }

    // --- Birthdays ----------------------------------------------------------------------------

    private function birthdays(string $template, array $shared): array
    {
        try {
            $profiles = CustomerProfile::query()
                ->whereNotNull('dob')
                ->with('user:id,name,phone')
                ->get();
        } catch (\Throwable) {
            return ['available' => false, 'rows' => []];
        }

        $today = CarbonImmutable::now(self::TZ)->startOfDay();
        $yearStart = $today->startOfYear()->utc();
        $rows = [];

        foreach ($profiles as $profile) {
            if (! $profile->user) {
                continue;
            }

            $dob = CarbonImmutable::parse($profile->dob);
            $occurrence = $this->occurrence($dob->month, $dob->day, $today->year);
            $diff = (int) $today->diffInDays($occurrence, false);

            // Dates near New Year can fall in next year's window (e.g. 2 Jan seen on 30 Dec).
            if ($diff < -2) {
                $next = $this->occurrence($dob->month, $dob->day, $today->year + 1);
                $nextDiff = (int) $today->diffInDays($next, false);
                if ($nextDiff <= 7) {
                    $occurrence = $next;
                    $diff = $nextDiff;
                }
            }
            if ($diff < -2 || $diff > 7) {
                continue;
            }

            $phone = Phone::fromStored($profile->user->phone);
            $name = $profile->user->name;
            $vars = ['name' => $name, 'services' => '', 'date' => $occurrence->format('D j M'), 'time' => ''];

            $rows[] = [
                'customer_id' => $profile->user->id,
                'name' => $name,
                'phone' => $phone ? Phone::display($phone) : null,
                'wa_phone' => $phone,
                'birthday' => $dob->format('j M'),
                'age' => ($dob->year > 1900 && $dob->year < $today->year) ? $occurrence->year - $dob->year : null,
                'days' => $diff,
                'opted_out' => (bool) $profile->whatsapp_opt_out,
                'message' => $this->fill($template, $vars + $shared),
                'vars' => $vars,
                'sent' => null,
            ];
        }

        usort($rows, fn ($a, $b) => $a['days'] <=> $b['days']);

        if ($this->logsReady() && $rows !== []) {
            $logs = ManualMessageLog::query()->with('sender:id,name')
                ->where('type', 'birthday')->where('sent_at', '>=', $yearStart)
                ->whereIn('customer_id', array_column($rows, 'customer_id'))
                ->orderBy('sent_at')->get()->keyBy('customer_id');

            foreach ($rows as &$row) {
                $log = $logs[$row['customer_id']] ?? null;
                $row['sent'] = $log ? ['at' => $log->sent_at?->toIso8601String(), 'by' => $log->sender?->name] : null;
            }
            unset($row);
        }

        return ['available' => true, 'rows' => $rows];
    }

    /** The birthday in a given year; 29 February counts as 28 February in non-leap years. */
    private function occurrence(int $month, int $day, int $year): CarbonImmutable
    {
        if ($month === 2 && $day === 29 && ! CarbonImmutable::create($year, 1, 1)->isLeapYear()) {
            $day = 28;
        }

        return CarbonImmutable::create($year, $month, $day, 0, 0, 0, self::TZ);
    }

    // --- Logging + templates ------------------------------------------------------------------

    public function log(Request $request): Response
    {
        $this->guard($request);

        $data = $request->validate([
            'type' => ['required', 'in:reminder,birthday,confirm'],
            'booking_id' => ['nullable', 'integer', 'exists:bookings,id'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'phone' => ['required', 'string', 'max:20'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        abort_if(in_array($data['type'], ['reminder', 'confirm'], true) && empty($data['booking_id']), 422);
        abort_if($data['type'] === 'birthday' && empty($data['customer_id']), 422);

        try {
            if ($this->logsReady()) {
                ManualMessageLog::create([
                    'type' => $data['type'],
                    'booking_id' => in_array($data['type'], ['reminder', 'confirm'], true) ? $data['booking_id'] : null,
                    'customer_id' => $data['type'] === 'birthday' ? $data['customer_id'] : null,
                    'phone' => preg_replace('/\D/', '', $data['phone']),
                    'message' => $data['message'],
                    'sent_by' => $request->user()->id,
                    'sent_at' => now(),
                ]);
            }
        } catch (\Throwable) {
            // Logging must never get in the way of the chat that was just opened.
        }

        return response()->noContent();
    }

    public function saveTemplate(Request $request)
    {
        $this->guard($request);

        $data = $request->validate([
            'key' => ['required', 'in:reminder,birthday,confirm'],
            'value' => ['nullable', 'string', 'max:600'],
        ]);

        $value = trim(strip_tags((string) ($data['value'] ?? '')));
        app(SettingService::class)->updateGroup('reminder', ["{$data['key']}.template" => $value]);

        return back()->with('success', $value === '' ? 'Template reset to the default.' : 'Template saved.');
    }

    // --- Helpers ------------------------------------------------------------------------------

    private function template(string $key, string $default): string
    {
        $value = trim((string) Setting::get($key));

        return $value !== '' ? $value : $default;
    }

    /** Same salon values the footer uses, with the same fallbacks. */
    private function sharedVars(): array
    {
        return [
            'salon' => (string) (Setting::get('business.name') ?: config('app.name')),
            'address' => (string) app(SeoService::class)->findUs()['address'],
            'phone' => (string) (Setting::get('business.phone') ?: '+92 305 9833859'),
        ];
    }

    private function fill(string $template, array $vars): string
    {
        $replace = [];
        foreach ($vars as $key => $value) {
            $replace['{' . $key . '}'] = (string) $value;
        }

        return trim(preg_replace('/ {2,}/', ' ', strtr($template, $replace)) ?? '');
    }

    /** @return array<int, ManualMessageLog> newest log per booking/customer id */
    private function latestLogs(string $type, string $column, array $ids): array
    {
        if ($ids === [] || ! $this->logsReady()) {
            return [];
        }

        try {
            return ManualMessageLog::query()->with('sender:id,name')
                ->where('type', $type)->whereIn($column, $ids)
                ->orderBy('sent_at')->get()->keyBy($column)->all();
        } catch (\Throwable) {
            return [];
        }
    }
}
