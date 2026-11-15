<?php

namespace App\Http\Controllers;

use App\Models\IncompleteBooking;
use App\Models\SiteEvent;
use Illuminate\Http\Request;
use Illuminate\Http\Response;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

/**
 * Anonymous visitor funnel (POST /track) and incomplete-booking capture (POST /track/incomplete).
 * Both are CSRF-protected and throttled (routes/web.php), validate against a whitelist, cap the payload,
 * and always answer 204: a tracking problem must never surface to the visitor. Nothing typed into a form
 * is recorded except the name and phone the visitor chose to leave for the booking follow-up.
 */
class TrackController extends Controller
{
    private const MAX_BODY_BYTES = 4000;

    private function ignore(Request $request): bool
    {
        // Respect Do Not Track, and drop oversized payloads.
        return $request->header('DNT') === '1' || strlen($request->getContent()) > self::MAX_BODY_BYTES;
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
        ]);

        try {
            if (Schema::hasTable('site_events')) {
                SiteEvent::create([
                    'session_id' => $data['session_id'],
                    'event' => $data['event'],
                    'path' => isset($data['path']) ? Str::limit(strtok($data['path'], '?') ?: '', 255, '') : null,
                    'meta' => isset($data['meta']) ? array_intersect_key($data['meta'], ['kind' => 1, 'id' => 1]) : null,
                    'ip' => $request->ip(),
                    'user_agent' => Str::limit((string) $request->userAgent(), 250, ''),
                ]);

                if ($data['event'] === 'booking_submitted' && Schema::hasTable('incomplete_bookings')) {
                    IncompleteBooking::where('session_id', $data['session_id'])->update(['status' => 'converted']);
                }
            }
        } catch (\Throwable) {
            // Never break the page for analytics.
        }

        return response()->noContent();
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
                if (! \App\Support\Phone::isValid((string) $value)) {
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
            if (Schema::hasTable('incomplete_bookings')) {
                $existing = IncompleteBooking::where('session_id', $data['session_id'])->first();

                // A converted booking stays converted; contacted stays contacted. Only the details refresh.
                IncompleteBooking::updateOrCreate(
                    ['session_id' => $data['session_id']],
                    [
                        'name' => trim(strip_tags($data['name'])),
                        'phone' => \App\Support\Phone::normalize($data['phone']),
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
        } catch (\Throwable) {
            // Never break the booking form for this.
        }

        return response()->noContent();
    }
}
