<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\ContactDraft;
use App\Models\IncompleteBooking;
use App\Models\ManualMessageLog;
use App\Models\Setting;
use App\Models\SiteEvent;
use App\Models\VisitorSession;
use App\Services\SettingService;
use App\Support\ClientIp;
use App\Support\GeoLocator;
use App\Support\Phone;
use Carbon\CarbonImmutable;
use Illuminate\Database\Eloquent\Builder;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;
use Inertia\Inertia;
use Inertia\Response as InertiaResponse;

/**
 * Admin > Follow-ups: people who started something and did not finish (incomplete bookings, unsent contact
 * forms, abandoned carts) plus anonymous visitors with a cart. Nothing is sent automatically: the WhatsApp
 * button opens a chat with a prepared message. IP address and full User-Agent are only ever shown in the
 * admin "Journey" panel. Old rows are pruned when the page loads (no cron).
 */
class FollowUpsController extends Controller
{
    public const DEFAULT_BOOKING = 'Assalam o Alaikum {name}, aap ne Looks Smart par {services} select ki thin. Kya hum aap ki booking confirm kar dein?';

    public const DEFAULT_CONTACT = 'Assalam o Alaikum {name}, Looks Smart Beauty Salon ki taraf se. Aap ne humein likha tha: "{message_short}". Hum aap ki kya madad kar sakte hain?';

    private const TYPES = ['booking' => IncompleteBooking::class, 'contact' => ContactDraft::class, 'session' => VisitorSession::class];

    private function guard(Request $request): void
    {
        abort_unless($request->user()?->can('bookings.manage'), 403);
    }

    private function has(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (\Throwable) {
            return false;
        }
    }

    // --- Page ---------------------------------------------------------------------------------

    public function index(Request $request): InertiaResponse
    {
        $this->guard($request);

        $tab = in_array($request->string('tab')->value(), ['bookings', 'contacts', 'carts', 'visitors'], true) ? $request->string('tab')->value() : 'bookings';
        $range = in_array($request->string('range')->value(), ['today', '7', '30'], true) ? $request->string('range')->value() : '7';
        $status = in_array($request->string('status')->value(), ['open', 'new', 'contacted', 'booked', 'not_interested', 'all'], true) ? $request->string('status')->value() : 'open';
        $q = trim($request->string('q')->value());
        $bots = $request->boolean('bots');

        $ready = [
            'bookings' => $this->has('incomplete_bookings'),
            'contacts' => $this->has('contact_drafts'),
            'sessions' => $this->has('visitor_sessions'),
        ];

        $this->prune($ready);

        $since = $range === 'today'
            ? CarbonImmutable::now('Asia/Karachi')->startOfDay()->utc()
            : CarbonImmutable::now()->subDays((int) $range);

        $botIds = $ready['sessions'] ? $this->botSessionIds($since) : [];
        $hidden = $bots ? 0 : count($botIds);

        $rows = match ($tab) {
            'contacts' => $ready['contacts'] ? $this->contactRows($since, $status, $q, $bots ? [] : $botIds) : [],
            'carts' => $ready['sessions'] ? $this->cartRows($since, $status, $q, $bots) : [],
            'visitors' => $ready['sessions'] ? $this->visitorRows($since, $status, $q, $bots) : [],
            default => $ready['bookings'] ? $this->bookingRows($since, $status, $q, $bots ? [] : $botIds) : [],
        };

        $shared = $this->sharedVars();

        return Inertia::render('Admin/FollowUps', [
            'ready' => $ready,
            'tab' => $tab,
            'filters' => ['range' => $range, 'status' => $status, 'q' => $q, 'bots' => $bots],
            'rows' => $this->withMessages($rows, $tab, $shared),
            'hiddenBots' => $hidden,
            'templates' => [
                'booking' => $this->template('followup.booking_template', self::DEFAULT_BOOKING),
                'contact' => $this->template('followup.contact_template', self::DEFAULT_CONTACT),
                'cart' => $this->template('followup.cart_template', self::DEFAULT_BOOKING),
                'defaults' => ['booking' => self::DEFAULT_BOOKING, 'contact' => self::DEFAULT_CONTACT, 'cart' => self::DEFAULT_BOOKING],
            ],
            'geo' => ['available' => GeoLocator::available()],
            'ipCheck' => ['ip' => ClientIp::get($request), 'source' => ClientIp::source($request), 'private' => ClientIp::isPrivate(ClientIp::get($request))],
        ]);
    }

    /** Old rows go when the page loads (no cron): events and sessions after 90 days, drafts after 180. */
    private function prune(array $ready): void
    {
        try {
            if ($this->has('site_events')) {
                SiteEvent::where('created_at', '<', now()->subDays(90))->delete();
            }
            if ($ready['sessions']) {
                VisitorSession::where('last_seen_at', '<', now()->subDays(90))->delete();
            }
            if ($ready['contacts']) {
                ContactDraft::where('last_seen_at', '<', now()->subDays(180))->delete();
            }
            if ($ready['bookings']) {
                IncompleteBooking::where('last_seen_at', '<', now()->subDays(180))->delete();
            }
        } catch (\Throwable) {
            // pruning is best effort
        }
    }

    /** @return list<string> */
    private function botSessionIds($since): array
    {
        try {
            return VisitorSession::where('is_bot', true)->where('last_seen_at', '>=', $since)->pluck('session_id')->all();
        } catch (\Throwable) {
            return [];
        }
    }

    private function statusFilter(Builder $query, string $status, string $bookedValue = 'booked'): void
    {
        match ($status) {
            'all' => null,
            'open' => $query->whereIn('status', ['new', 'contacted']),
            'booked' => $query->where('status', $bookedValue),
            default => $query->where('status', $status),
        };
    }

    private function search(Builder $query, string $q): void
    {
        if ($q === '') {
            return;
        }

        $digits = preg_replace('/\D/', '', $q) ?? '';
        $query->where(function ($inner) use ($q, $digits) {
            $inner->where('name', 'like', "%{$q}%");
            if (strlen($digits) >= 3) {
                $inner->orWhere('phone', 'like', "%{$digits}%");
            }
        });
    }

    // --- Tab queries --------------------------------------------------------------------------

    private function bookingRows($since, string $status, string $q, array $excludeSessions): array
    {
        $query = IncompleteBooking::query()->where('last_seen_at', '>=', $since)->orderByDesc('last_seen_at')->limit(200);
        $this->statusFilter($query, $status, 'converted');
        $this->search($query, $q);
        if ($excludeSessions !== []) {
            $query->whereNotIn('session_id', $excludeSessions);
        }

        return $query->get()->map(fn (IncompleteBooking $r) => [
            'key' => "booking:{$r->id}", 'type' => 'booking', 'id' => $r->id, 'session_id' => $r->session_id,
            'name' => $r->name, 'phone' => $r->phone,
            'items' => collect($r->items ?? [])->pluck('name')->all(), 'total' => $r->total,
            'status' => $r->status === 'converted' ? 'booked' : $r->status,
            'note' => $this->noteOf($r), 'last_activity' => $r->last_seen_at?->toIso8601String(),
        ])->all();
    }

    private function noteOf($row): ?string
    {
        try {
            return $row->getAttribute('note');
        } catch (\Throwable) {
            return null;
        }
    }

    private function contactRows($since, string $status, string $q, array $excludeSessions): array
    {
        $query = ContactDraft::query()->where('status', '!=', 'sent')->where('last_seen_at', '>=', $since)->orderByDesc('last_seen_at')->limit(200);
        $this->statusFilter($query, $status);
        $this->search($query, $q);
        if ($excludeSessions !== []) {
            $query->whereNotIn('session_id', $excludeSessions);
        }

        return $query->get()->map(fn (ContactDraft $r) => [
            'key' => "contact:{$r->id}", 'type' => 'contact', 'id' => $r->id, 'session_id' => $r->session_id,
            'name' => $r->name, 'phone' => $r->phone, 'email' => $r->email, 'subject' => $r->subject, 'message' => $r->message,
            'status' => $r->status, 'note' => $r->note, 'last_activity' => $r->last_seen_at?->toIso8601String(),
        ])->all();
    }

    private function sessionBase($since, bool $bots): Builder
    {
        return VisitorSession::query()->where('last_seen_at', '>=', $since)
            ->when(! $bots, fn ($q) => $q->where('is_bot', false))
            ->orderByDesc('last_seen_at')->limit(200);
    }

    private function cartRows($since, string $status, string $q, bool $bots): array
    {
        $query = $this->sessionBase($since, $bots)
            ->whereNotNull('cart')->where('cart_updated_at', '<', now()->subMinutes(30))
            ->where('status', '!=', 'booked')
            ->where(fn ($w) => $w->whereNotNull('phone')->orWhereNotNull('user_id'));
        $this->statusFilter($query, $status === 'booked' ? 'all' : $status);
        $this->search($query, $q);

        return $query->get()->map(fn (VisitorSession $s) => $this->sessionRow($s, 'carts'))->all();
    }

    private function visitorRows($since, string $status, string $q, bool $bots): array
    {
        $query = $this->sessionBase($since, $bots)
            ->whereNull('phone')->whereNull('user_id')
            ->where(function ($w) {
                $w->whereNotNull('cart')->orWhereExists(function ($sub) {
                    $sub->selectRaw('1')->from('site_events')
                        ->whereColumn('site_events.session_id', 'visitor_sessions.session_id')
                        ->where('site_events.event', 'begin_booking');
                });
            });
        $this->statusFilter($query, $status === 'open' ? 'all' : $status);

        return $query->get()->map(fn (VisitorSession $s) => $this->sessionRow($s, 'visitors'))->all();
    }

    private function sessionRow(VisitorSession $s, string $tab): array
    {
        $items = collect($s->cart ?? []);

        return [
            'key' => "session:{$s->id}", 'type' => 'session', 'id' => $s->id, 'session_id' => $s->session_id,
            'name' => $tab === 'visitors' ? null : $s->name, 'phone' => $tab === 'visitors' ? null : $s->phone,
            'items' => $items->pluck('name')->all(), 'total' => $s->cart_total,
            'status' => $s->status, 'note' => $s->note, 'last_activity' => $s->last_seen_at?->toIso8601String(),
        ];
    }

    // --- Row decoration -----------------------------------------------------------------------

    /** Adds device, location, source, WhatsApp number and the prepared message to every row. */
    private function withMessages(array $rows, string $tab, array $shared): array
    {
        if ($rows === []) {
            return [];
        }

        $sessions = [];
        try {
            if ($this->has('visitor_sessions')) {
                $sessions = VisitorSession::whereIn('session_id', array_column($rows, 'session_id'))->get()->keyBy('session_id');
            }
        } catch (\Throwable) {
            $sessions = [];
        }

        return array_map(function (array $row) use ($sessions, $tab, $shared) {
            $s = $sessions[$row['session_id']] ?? null;
            $stored = Phone::fromStored($row['phone'] ?? null);

            $row['wa_phone'] = $stored;
            $row['phone'] = $stored ? Phone::display($stored) : null;
            $row['device'] = $s ? ['type' => $s->device_type, 'label' => trim(($s->os ?: '') . ' · ' . ($s->browser ?: ''), ' ·')] : null;
            $row['location'] = $s ? $this->location($s) : null;
            $row['source'] = $s?->source;

            $services = implode(', ', $row['items'] ?? []);
            $message = (string) ($row['message'] ?? '');
            $template = $row['type'] === 'contact' ? 'contact' : ($tab === 'carts' ? 'cart' : 'booking');
            $row['message_text'] = $this->fill(
                $this->template("followup.{$template}_template", $template === 'contact' ? self::DEFAULT_CONTACT : self::DEFAULT_BOOKING),
                [
                    'name' => $row['name'] ?: 'there',
                    'services' => $services,
                    'subject' => (string) ($row['subject'] ?? ''),
                    'message_short' => Str::limit(trim(preg_replace('/\s+/', ' ', $message) ?? ''), 100, '...'),
                ] + $shared,
            );
            $row['vars'] = ['name' => $row['name'] ?: 'Ayesha', 'services' => $services ?: 'Facial', 'subject' => (string) ($row['subject'] ?? ''), 'message_short' => Str::limit($message, 100, '...')];
            $row['can_contact'] = $stored !== null && $tab !== 'visitors';

            return $row;
        }, $rows);
    }

    private function location(VisitorSession $s): ?array
    {
        if ($s->city === 'Local network') {
            return ['text' => 'Local network', 'approx' => false];
        }
        $text = collect([$s->city, $s->region])->filter()->implode(', ');

        return $text === '' ? null : ['text' => $text, 'approx' => true];
    }

    // --- Journey ------------------------------------------------------------------------------

    public function journey(Request $request): JsonResponse
    {
        $this->guard($request);

        $sid = (string) $request->query('session_id');
        abort_unless(preg_match('/^[A-Za-z0-9_-]{8,64}$/', $sid) === 1, 422);

        $session = $this->has('visitor_sessions') ? VisitorSession::where('session_id', $sid)->first() : null;
        $events = [];
        $pages = [];

        if ($this->has('site_events')) {
            $labels = ['add_to_cart' => 'Added to cart', 'begin_booking' => 'Reached the booking page', 'form_started' => 'Started the booking form', 'booking_submitted' => 'Submitted a booking'];
            $rows = SiteEvent::where('session_id', $sid)->orderBy('created_at')->limit(300)->get(['event', 'path', 'meta', 'created_at']);

            foreach ($rows as $row) {
                if (isset($labels[$row->event])) {
                    $events[] = ['label' => $labels[$row->event], 'at' => $row->created_at?->toIso8601String()];
                } elseif ($row->event === 'page_view') {
                    $pages[] = ['path' => $row->path, 'at' => $row->created_at?->toIso8601String()];
                }
            }
        }

        if ($session) {
            array_unshift($events, ['label' => 'Session start', 'at' => $session->first_seen_at?->toIso8601String()]);
        }
        foreach ([[IncompleteBooking::class, 'booking', 'Booking details saved'], [ContactDraft::class, 'contact', 'Contact form draft saved']] as [$model, $key, $label]) {
            $table = (new $model)->getTable();
            if ($this->has($table)) {
                $draft = $model::where('session_id', $sid)->first();
                if ($draft) {
                    $events[] = ['label' => $label, 'at' => $draft->last_seen_at?->toIso8601String()];
                }
            }
        }
        usort($events, fn ($a, $b) => strcmp((string) $a['at'], (string) $b['at']));

        return response()->json([
            'session' => $session ? [
                'first_seen_at' => $session->first_seen_at?->toIso8601String(),
                'device' => collect([$session->device_type, $session->os, $session->browser])->filter()->implode(' · '),
                'screen' => $session->screen, 'language' => $session->language, 'timezone' => $session->timezone,
                'source' => $session->source, 'landing_path' => $session->landing_path,
                'ip' => $session->ip, 'user_agent' => $session->user_agent,
                'city' => $session->city, 'region' => $session->region, 'country' => $session->country,
            ] : null,
            'events' => $events,
            'pages' => array_slice(array_reverse($pages), 0, 10),
        ]);
    }

    // --- Actions ------------------------------------------------------------------------------

    private function find(string $type, int $id)
    {
        abort_unless(isset(self::TYPES[$type]), 404);
        $model = self::TYPES[$type];

        return $model::findOrFail($id);
    }

    public function updateStatus(Request $request, string $type, int $id): RedirectResponse
    {
        $this->guard($request);

        $data = $request->validate(['status' => ['required', 'in:new,contacted,booked,not_interested']]);
        $row = $this->find($type, $id);
        $row->update(['status' => ($type === 'booking' && $data['status'] === 'booked') ? 'converted' : $data['status']]);

        return back();
    }

    public function updateNote(Request $request, string $type, int $id): RedirectResponse
    {
        $this->guard($request);

        $data = $request->validate(['note' => ['nullable', 'string', 'max:1000']]);
        $row = $this->find($type, $id);

        try {
            $row->update(['note' => filled($data['note'] ?? null) ? strip_tags($data['note']) : null]);
        } catch (\Throwable) {
            return back()->with('error', 'The notes column is missing: run the SQL first.');
        }

        return back();
    }

    /** The WhatsApp button was clicked: status becomes "contacted" (only from "new") and the click is logged. */
    public function contacted(Request $request, string $type, int $id): Response
    {
        $this->guard($request);

        $row = $this->find($type, $id);
        if ($row->status === 'new') {
            $row->update(['status' => 'contacted']);
        }

        try {
            if ($this->has('manual_message_logs')) {
                ManualMessageLog::create([
                    'type' => 'followup', 'phone' => preg_replace('/\D/', '', (string) $request->input('phone')) ?: '0',
                    'message' => Str::limit((string) $request->input('message'), 1900, ''),
                    'sent_by' => $request->user()->id, 'sent_at' => now(),
                ]);
            }
        } catch (\Throwable) {
            // logging must not block the chat that was just opened
        }

        return response()->noContent();
    }

    public function destroy(Request $request, string $type, int $id): RedirectResponse
    {
        $this->guard($request);

        $this->find($type, $id)->delete();

        return back()->with('success', 'Removed.');
    }

    public function saveTemplate(Request $request): RedirectResponse
    {
        $this->guard($request);

        $data = $request->validate(['key' => ['required', 'in:booking,contact,cart'], 'value' => ['nullable', 'string', 'max:600']]);
        $value = trim(strip_tags((string) ($data['value'] ?? '')));
        app(SettingService::class)->updateGroup('followup', ["followup.{$data['key']}_template" => $value]);

        return back()->with('success', $value === '' ? 'Template reset to the default.' : 'Template saved.');
    }

    // --- Helpers ------------------------------------------------------------------------------

    /** Count shown on the sidebar badge: "new" rows across the first three tabs. */
    public static function newCount(): int
    {
        try {
            $count = 0;
            if (Schema::hasTable('incomplete_bookings')) {
                $count += IncompleteBooking::where('status', 'new')->count();
            }
            if (Schema::hasTable('contact_drafts')) {
                $count += ContactDraft::where('status', 'new')->count();
            }
            if (Schema::hasTable('visitor_sessions')) {
                $count += VisitorSession::where('is_bot', false)->where('status', 'new')
                    ->whereNotNull('cart')->where('cart_updated_at', '<', now()->subMinutes(30))
                    ->where(fn ($w) => $w->whereNotNull('phone')->orWhereNotNull('user_id'))->count();
            }

            return $count;
        } catch (\Throwable) {
            return 0;
        }
    }

    private function template(string $key, string $default): string
    {
        $value = trim((string) Setting::get($key));

        return $value !== '' ? $value : $default;
    }

    private function sharedVars(): array
    {
        return [
            'salon' => (string) (Setting::get('business.name') ?: config('app.name')),
            'address' => (string) app(\App\Services\SeoService::class)->findUs()['address'],
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
}
