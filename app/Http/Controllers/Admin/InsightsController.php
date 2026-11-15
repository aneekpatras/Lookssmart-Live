<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\Deal;
use App\Models\IncompleteBooking;
use App\Models\SecurityEvent;
use App\Models\Service;
use App\Models\SiteEvent;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Schema;
use Inertia\Inertia;
use Inertia\Response;

/**
 * Admin pages that read the anonymous tracking tables: Visitor funnel, Incomplete bookings and the
 * Security log. Every page copes with a missing table (the SQL may not have been run yet) and prunes rows
 * older than 90 days when it loads, so no cron is needed.
 */
class InsightsController extends Controller
{
    private const STEPS = [
        'add_to_cart' => 'Added to cart',
        'begin_booking' => 'Reached the booking page',
        'form_started' => 'Started the booking form',
        'booking_submitted' => 'Submitted a booking',
    ];

    private function guard(Request $request, string $permission): void
    {
        abort_unless($request->user()?->can($permission), 403);
    }

    // --- Visitor funnel -----------------------------------------------------------------------

    public function funnel(Request $request): Response
    {
        $this->guard($request, 'bookings.manage');

        $days = $request->integer('days') === 30 ? 30 : 7;

        if (! Schema::hasTable('site_events')) {
            return Inertia::render('Admin/Insights/Funnel', ['ready' => false, 'days' => $days, 'steps' => [], 'top' => []]);
        }

        SiteEvent::where('created_at', '<', now()->subDays(90))->delete();

        $since = now()->subDays($days);
        $counts = SiteEvent::query()
            ->where('created_at', '>=', $since)
            ->selectRaw('event, COUNT(DISTINCT session_id) as sessions')
            ->groupBy('event')
            ->pluck('sessions', 'event');

        $steps = [];
        $previous = null;
        foreach (self::STEPS as $key => $label) {
            $sessions = (int) ($counts[$key] ?? 0);
            $steps[] = [
                'key' => $key,
                'label' => $label,
                'sessions' => $sessions,
                'dropoff' => $previous !== null && $previous > 0 ? max(0, round((1 - $sessions / $previous) * 100)) : null,
            ];
            $previous = $sessions;
        }

        return Inertia::render('Admin/Insights/Funnel', [
            'ready' => true,
            'days' => $days,
            'steps' => $steps,
            'top' => $this->topAdded($since),
        ]);
    }

    /** @return list<array{name: string, kind: string, sessions: int}> */
    private function topAdded($since): array
    {
        $tally = [];
        SiteEvent::query()
            ->where('event', 'add_to_cart')->where('created_at', '>=', $since)
            ->whereNotNull('meta')
            ->limit(20000)
            ->get(['session_id', 'meta'])
            ->each(function (SiteEvent $event) use (&$tally) {
                $kind = $event->meta['kind'] ?? null;
                $id = (int) ($event->meta['id'] ?? 0);
                if ($id > 0 && in_array($kind, ['service', 'deal'], true)) {
                    $tally["{$kind}:{$id}"][$event->session_id] = true;
                }
            });

        $rows = collect($tally)->map(fn ($sessions) => count($sessions))->sortDesc()->take(10);
        $serviceNames = Service::whereIn('id', $rows->keys()->filter(fn ($k) => str_starts_with($k, 'service:'))->map(fn ($k) => (int) substr($k, 8)))->pluck('name', 'id');
        $dealNames = Deal::whereIn('id', $rows->keys()->filter(fn ($k) => str_starts_with($k, 'deal:'))->map(fn ($k) => (int) substr($k, 5)))->pluck('title', 'id');

        return $rows->map(function (int $sessions, string $key) use ($serviceNames, $dealNames) {
            [$kind, $id] = explode(':', $key);

            return [
                'name' => ($kind === 'service' ? $serviceNames[(int) $id] : $dealNames[(int) $id]) ?? ucfirst($kind) . " #{$id}",
                'kind' => $kind,
                'sessions' => $sessions,
            ];
        })->values()->all();
    }

    // --- Security log -------------------------------------------------------------------------

    public function security(Request $request): Response
    {
        $this->guard($request, 'settings.manage');

        if (! Schema::hasTable('security_events')) {
            return Inertia::render('Admin/Insights/SecurityLog', [
                'ready' => false, 'events' => [], 'topIps' => [], 'types' => SecurityEvent::TYPES, 'type' => null,
            ]);
        }

        SecurityEvent::where('created_at', '<', now()->subDays(90))->delete();

        $type = in_array($request->string('type')->value(), SecurityEvent::TYPES, true)
            ? $request->string('type')->value() : null;

        $topIps = SecurityEvent::query()
            ->where('created_at', '>=', now()->subDay())->whereNotNull('ip')
            ->selectRaw("ip, SUM(CASE WHEN type = 'login_failed' THEN 1 ELSE 0 END) as failed_logins, SUM(CASE WHEN type = 'form_spam' THEN 1 ELSE 0 END) as spam_hits, SUM(CASE WHEN type = 'lockout' THEN 1 ELSE 0 END) as lockouts")
            ->groupBy('ip')
            ->havingRaw("SUM(CASE WHEN type IN ('login_failed','form_spam','lockout') THEN 1 ELSE 0 END) > 0")
            ->orderByRaw("SUM(CASE WHEN type IN ('login_failed','form_spam','lockout') THEN 1 ELSE 0 END) DESC")
            ->limit(10)->get()
            ->map(fn ($row) => [
                'ip' => $row->ip,
                'failed_logins' => (int) $row->failed_logins,
                'spam_hits' => (int) $row->spam_hits,
                'lockouts' => (int) $row->lockouts,
            ]);

        return Inertia::render('Admin/Insights/SecurityLog', [
            'ready' => true,
            'types' => SecurityEvent::TYPES,
            'type' => $type,
            'topIps' => $topIps,
            'events' => SecurityEvent::query()
                ->when($type, fn ($q) => $q->where('type', $type))
                ->orderByDesc('created_at')->orderByDesc('id')->limit(100)->get()
                ->map(fn (SecurityEvent $e) => [
                    'id' => $e->id,
                    'type' => $e->type,
                    'ip' => $e->ip,
                    'subject' => $e->subject,
                    'user_id' => $e->user_id,
                    'user_agent' => $e->user_agent,
                    'created_at' => $e->created_at?->toIso8601String(),
                ])->values(),
        ]);
    }
}
