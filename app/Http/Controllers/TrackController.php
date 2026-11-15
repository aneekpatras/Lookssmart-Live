<?php

namespace App\Http\Controllers;

use App\Models\ContactDraft;
use App\Models\IncompleteBooking;
use App\Models\SiteEvent;
use App\Models\VisitorSession;
use App\Support\ClientIp;
use App\Support\DeviceParser;
use App\Support\FollowUps;
use App\Support\GeoLocator;
use App\Support\Phone;
use App\Support\TrafficSource;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Anonymous visitor funnel (POST /track), incomplete-booking capture (POST /track/incomplete) and contact
 * form drafts (POST /track/contact). All are CSRF-protected and throttled (routes/web.php), validate against
 * a whitelist, cap the payload, and always answer 204: a tracking problem must never surface to the visitor.
 * Nothing typed into a form is recorded except what the visitor chose to leave in the booking and contact
 * drafts. Do Not Track sends nothing (the client) and is also honoured here.
 */
class TrackController extends Controller
{
    private const MAX_BODY_BYTES = 12000;

    private const MAX_PAGE_VIEWS_PER_DAY = 25;

    private function ignore(Request $request): bool
    {
        return $request->header('DNT') === '1' || strlen($request->getContent()) > self::MAX_BODY_BYTES;
    }

    private function has(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (\Throwable) {
            return false;
        }
    }

    public function event(Request $request): Response
    {
        if ($this->ignore($request)) {
            return response()->noContent();
        }

        $data = $request->validate([
            'session_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'],
            'event' => ['required', 'string', 'in:' . implode(',', SiteEvent::EVENTS)],
            'path' => ['nullable', 'string', 'max:255'],
            'meta' => ['nullable', 'array', 'max:4'],
            'meta.kind' => ['nullable', 'string', 'in:service,deal'],
            'meta.id' => ['nullable', 'integer', 'min:1'],
            // session_start details
            'screen' => ['nullable', 'string', 'regex:/^\d{2,5}x\d{2,5}$/'],
            'language' => ['nullable', 'string', 'max:12'],
            'timezone' => ['nullable', 'string', 'max:40'],
            'referrer_host' => ['nullable', 'string', 'max:100'],
            'utm_source' => ['nullable', 'string', 'max:60'],
            'utm_medium' => ['nullable', 'string', 'max:60'],
            'utm_campaign' => ['nullable', 'string', 'max:60'],
            // cart_update snapshot: names, ids, types and prices only, capped
            'cart' => ['nullable', 'array'],
            'cart.items' => ['nullable', 'array', 'max:40'],
            'cart.items.*.id' => ['required', 'integer'],
            'cart.items.*.name' => ['required', 'string', 'max:120'],
            'cart.items.*.type' => ['nullable', 'in:service,deal'],
            'cart.items.*.price' => ['nullable', 'numeric', 'min:0'],
            'cart.total' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
        ]);

        try {
            if ($this->has('site_events')) {
                $this->record($request, $data);
            }
        } catch (\Throwable) {
            // Never break the page for analytics.
        }

        return response()->noContent();
    }

    private function record(Request $request, array $data): void
    {
        $sessionId = $data['session_id'];
        $event = $data['event'];
        $path = isset($data['path']) ? Str::limit(strtok($data['path'], '?') ?: '', 255, '') : null;

        $session = $this->touchSession($request, $data, $path);

        if ($event === 'page_view') {
            $today = SiteEvent::where('session_id', $sessionId)->where('event', 'page_view')->where('created_at', '>=', now()->startOfDay())->count();
            if ($today >= self::MAX_PAGE_VIEWS_PER_DAY) {
                return;
            }
            $session?->increment('pages_count');
        }

        if ($event === 'cart_update' && $session) {
            $items = collect($data['cart']['items'] ?? [])->map(fn ($i) => [
                'id' => (int) $i['id'],
                'name' => strip_tags((string) $i['name']),
                'type' => $i['type'] ?? 'service',
                'price' => isset($i['price']) ? (float) $i['price'] : null,
            ])->values()->all();

            $session->update($items === []
                ? ['cart' => null, 'cart_total' => null, 'cart_updated_at' => null]
                : ['cart' => $items, 'cart_total' => $data['cart']['total'] ?? null, 'cart_updated_at' => now()]);
        }

        if ($event === 'booking_submitted') {
            $session?->update(['status' => 'booked']);
            if ($this->has('incomplete_bookings')) {
                IncompleteBooking::where('session_id', $sessionId)->update(['status' => 'converted']);
            }
            if ($this->has('contact_drafts')) {
                ContactDraft::where('session_id', $sessionId)->where('status', '!=', 'sent')->update(['status' => 'booked']);
            }
        }

        // The state-only events (session_start, cart_update) update the session row; they are not funnel rows.
        if (in_array($event, ['session_start', 'cart_update'], true)) {
            return;
        }

        SiteEvent::create([
            'session_id' => $sessionId,
            'event' => $event,
            'path' => $path,
            'meta' => isset($data['meta']) ? array_intersect_key($data['meta'], ['kind' => 1, 'id' => 1]) : null,
            'ip' => ClientIp::get($request),
            'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
        ]);
    }

    /** Creates the visitor session row on first sight (device, source and city are worked out once), then updates it. */
    private function touchSession(Request $request, array $data, ?string $path): ?VisitorSession
    {
        if (! $this->has('visitor_sessions')) {
            return null;
        }

        $session = VisitorSession::firstOrNew(['session_id' => $data['session_id']]);

        if (! $session->exists) {
            $ip = ClientIp::get($request);
            $device = DeviceParser::parse($request->userAgent());
            $geo = GeoLocator::lookup($ip);

            $session->fill([
                'first_seen_at' => now(),
                'ip' => $ip,
                'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
                'device_type' => $device['device_type'],
                'browser' => $device['browser'],
                'os' => $device['os'],
                'is_bot' => $device['is_bot'],
                'country' => $geo['country'],
                'region' => $geo['region'],
                'city' => $geo['city'],
                'landing_path' => $path,
                'status' => 'new',
                'pages_count' => 0,
            ]);
        }

        if ($data['event'] === 'session_start') {
            $session->fill(array_filter([
                'screen' => $data['screen'] ?? null,
                'language' => isset($data['language']) ? mb_substr($data['language'], 0, 12) : null,
                'timezone' => $data['timezone'] ?? null,
                'landing_path' => $path,
                'source' => TrafficSource::label(
                    $data['referrer_host'] ?? null,
                    $data['utm_source'] ?? null,
                    $data['utm_medium'] ?? null,
                    $data['utm_campaign'] ?? null,
                    $request->getHost(),
                ),
            ]));
        }

        // A logged-in visitor links the session to their account (name and phone come from the server).
        if ($user = $request->user()) {
            $session->user_id = $user->id;
            $session->name ??= mb_substr((string) $user->name, 0, 100);
            if (! $session->phone && $user->phone) {
                $session->phone = Phone::fromStored($user->phone);
            }
        }

        $session->last_seen_at = now();
        $session->save();

        return $session;
    }

    public function incomplete(Request $request): Response
    {
        if ($this->ignore($request)) {
            return response()->noContent();
        }

        $data = $request->validate([
            'session_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'],
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:20', function ($attribute, $value, $fail) {
                if (! Phone::isValid((string) $value)) {
                    $fail('Invalid phone.');
                }
            }],
            'items' => ['nullable', 'array', 'max:30'],
            'items.*.id' => ['required', 'integer'],
            'items.*.name' => ['required', 'string', 'max:120'],
            'items.*.price' => ['nullable', 'numeric', 'min:0'],
            'total' => ['nullable', 'numeric', 'min:0', 'max:9999999999'],
        ]);

        try {
            if ($this->has('incomplete_bookings')) {
                $existing = IncompleteBooking::where('session_id', $data['session_id'])->first();

                // A converted booking stays converted; contacted stays contacted. Only the details refresh.
                IncompleteBooking::updateOrCreate(
                    ['session_id' => $data['session_id']],
                    [
                        'name' => trim(strip_tags($data['name'])),
                        'phone' => Phone::normalize($data['phone']),
                        'items' => collect($data['items'] ?? [])->map(fn ($i) => [
                            'id' => (int) $i['id'],
                            'name' => strip_tags((string) $i['name']),
                            'price' => isset($i['price']) ? (float) $i['price'] : null,
                        ])->all(),
                        'total' => $data['total'] ?? null,
                        'status' => $existing?->status ?? 'new',
                        'last_seen_at' => now(),
                    ],
                );
            }

            FollowUps::linkIdentity($data['session_id'], $data['name'], $data['phone'], $request->user()?->id);
        } catch (\Throwable) {
            // Never break the booking form for this.
        }

        return response()->noContent();
    }

    /** Contact form draft: saved once name and a valid phone are filled; "sent" once the form is really submitted. */
    public function contact(Request $request): Response
    {
        if ($this->ignore($request) || filled($request->input('website'))) {
            return response()->noContent(); // DNT, oversized, or honeypot: save nothing
        }

        $data = $request->validate([
            'session_id' => ['required', 'string', 'regex:/^[A-Za-z0-9_-]{8,64}$/'],
            'name' => ['required', 'string', 'max:100'],
            'phone' => ['required', 'string', 'max:30', function ($attribute, $value, $fail) {
                if (! Phone::isValid((string) $value)) {
                    $fail('Invalid phone.');
                }
            }],
            'email' => ['nullable', 'email', 'max:150'],
            'subject' => ['nullable', 'string', 'max:150'],
            'message' => ['nullable', 'string', 'max:2000'],
        ]);

        try {
            if ($this->has('contact_drafts')) {
                $existing = ContactDraft::where('session_id', $data['session_id'])->first();

                // A message that was really sent is never reopened as a draft.
                if ($existing?->status !== 'sent') {
                    ContactDraft::updateOrCreate(
                        ['session_id' => $data['session_id']],
                        [
                            'name' => trim(strip_tags($data['name'])),
                            'phone' => Phone::normalize($data['phone']),
                            'email' => $data['email'] ?? null,
                            'subject' => isset($data['subject']) ? strip_tags($data['subject']) : null,
                            'message' => isset($data['message']) ? strip_tags($data['message']) : null,
                            'status' => $existing?->status ?? 'new',
                            'last_seen_at' => now(),
                        ],
                    );
                }
            }

            FollowUps::linkIdentity($data['session_id'], $data['name'], $data['phone'], $request->user()?->id);
        } catch (\Throwable) {
            // Never break the contact form for this.
        }

        return response()->noContent();
    }
}
