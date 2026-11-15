<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Booking;
use App\Models\CustomerProfile;
use App\Models\ManualMessageLog;
use App\Models\Setting;
use App\Services\SeoService;
use App\Services\SettingService;
use App\Support\Phone;
use Carbon\CarbonImmutable;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Schema;
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

        return Inertia::render('Admin/Reminders', [
            'logsReady' => $this->logsReady(),
            'range' => $range,
            'shared' => $shared,
            'templates' => [
                'reminder' => $reminderTemplate,
                'birthday' => $birthdayTemplate,
                'defaults' => ['reminder' => self::DEFAULT_REMINDER, 'birthday' => self::DEFAULT_BIRTHDAY],
            ],
            'appointments' => $this->appointments($range, $reminderTemplate, $shared),
            'birthdays' => $this->birthdays($birthdayTemplate, $shared),
        ]);
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
            'type' => ['required', 'in:reminder,birthday'],
            'booking_id' => ['nullable', 'integer', 'exists:bookings,id'],
            'customer_id' => ['nullable', 'integer', 'exists:users,id'],
            'phone' => ['required', 'string', 'max:20'],
            'message' => ['required', 'string', 'max:2000'],
        ]);

        abort_if($data['type'] === 'reminder' && empty($data['booking_id']), 422);
        abort_if($data['type'] === 'birthday' && empty($data['customer_id']), 422);

        try {
            if ($this->logsReady()) {
                ManualMessageLog::create([
                    'type' => $data['type'],
                    'booking_id' => $data['type'] === 'reminder' ? $data['booking_id'] : null,
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
            'key' => ['required', 'in:reminder,birthday'],
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
