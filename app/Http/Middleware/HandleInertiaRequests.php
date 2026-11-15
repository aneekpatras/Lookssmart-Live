<?php

namespace App\Http\Middleware;

use App\Models\BusinessHour;
use App\Models\Setting;
use App\Models\User;
use App\Support\PasswordPolicy;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Cache;
use Inertia\Inertia;
use Inertia\Middleware;
use Tighten\Ziggy\Ziggy;

class HandleInertiaRequests extends Middleware
{
    /**
     * The root template that's loaded on the first page visit.
     */
    protected $rootView = 'app';

    /**
     * Determine the current asset version.
     */
    public function version(Request $request): ?string
    {
        return parent::version($request);
    }

    /**
     * Define the props that are shared by default.
     *
     * SECURITY: only safe, non-sensitive fields are shared here. The auth user is exposed as an
     * explicit allow-list (id/name/email/roles/permissions once Phase 3 adds them) — never the
     * full model, which would leak the password hash, remember_token, 2FA secret, etc.
     */
    public function share(Request $request): array
    {
        $user = $request->user();

        return [
            ...parent::share($request),
            'auth' => [
                'user' => $user ? [
                    'id' => $user->id,
                    'name' => $user->name,
                    'email' => $user->email,
                    'phone' => $user->phone,
                    'email_verified' => $user->hasVerifiedEmail(),
                    'two_factor_enabled' => (bool) $user->two_factor_confirmed_at,
                    'roles' => $user->getRoleNames(),
                    // Includes permissions inherited via role, not just directly-assigned ones —
                    // that's what actually matters for filtering the admin nav (Phase 5). This is a
                    // UI convenience only; every permission is re-checked server-side regardless.
                    'permissions' => $user->getAllPermissions()->pluck('name'),
                ] : null,
                // Phase 5 sub-step 4: `impersonator_id` is only ever set by
                // ImpersonationController::start() and read by ::stop() — never trust a client for
                // this, it drives whether the "you're impersonating" banner (with its exit button)
                // renders at all.
                'impersonating' => $request->session()->has('impersonator_id')
                    ? ['by' => User::find($request->session()->get('impersonator_id'))?->name]
                    : null,
            ],
            'flash' => [
                'success' => fn () => $request->session()->get('success'),
                'error' => fn () => $request->session()->get('error'),
            ],
            'ziggy' => fn () => [
                ...(new Ziggy)->toArray(),
                'location' => $request->url(),
            ],
            // Phase 13 sub-step 2: the per-request nonce `SecurityHeaders` already generates and
            // shares with Blade views (`$cspNonce`) — needed so `SeoHead.tsx` can put it on the
            // GA4/GTM `<script>` tags it renders, since a nonce-based CSP (no `unsafe-inline`) would
            // otherwise silently block them. `SecurityHeaders` runs before this middleware in the
            // global stack, so the shared view value already exists by the time this closure runs.
            'cspNonce' => fn () => view()->shared('cspNonce'),
            // Phase 13 sub-step 1: shared fallback for `SeoHead.tsx` so every public page gets a
            // real (or honestly-absent) Open Graph image/site name without each controller having to
            // pass it individually — `business.name`/`business.logo_path` are the only real, already
            // admin-editable source for this (Phase 10). Phase 13 sub-step 2 added the analytics/GSC
            // keys — `SeoHead` is only ever rendered on `Public/*` pages (never `Admin/*`), so putting
            // them here rather than per-controller doesn't leak analytics scripts onto admin pages;
            // each is `null` (and rendered as absent, never a fabricated placeholder id) until the
            // matching Setting is actually configured.
            'seo' => fn () => [
                'siteName' => Setting::get('business.name') ?: config('app.name'),
                'defaultImage' => $this->defaultOgImage(),
                'gtmId' => Setting::get('integrations.google_tag_manager_id') ?: null,
                'ga4Id' => Setting::get('integrations.google_analytics_id') ?: null,
                'gscVerification' => Setting::get('integrations.google_site_verification') ?: null,
            ],
            // Contact details, trading hours and social profiles for the public footer, which renders
            // on EVERY public page via PublicLayout. Shared rather than passed per-controller because
            // otherwise all 11 public routes would each have to remember to supply it, and any that
            // forgot would silently render a footer with missing contact details. Previously the
            // footer hardcoded its own hours string, which could (and did) disagree with the
            // `business_hours` table the Contact page reads.
            //
            // Every `Setting::get()` here is database-cached for 5 minutes and the hours summary has its
            // own cache entry, so this costs no per-request queries in the steady state. Admin pages
            // receive it too and simply ignore it — cheaper than branching on the request path.
            // Deliberately named `site`, NOT `business`: Inertia merges page props over shared props
            // shallowly, so a page that passes its own `business` prop (Contact and PrivacyPolicy
            // both do) would replace this entire object and leave the footer reading `hours` off
            // undefined. Found by actually inspecting the serialised page payload for these two
            // routes rather than assuming the merge was deep.
            'site' => fn () => [
                'name' => Setting::get('business.name') ?: config('app.name'),
                'phone' => Setting::get('business.phone') ?: null,
                'email' => Setting::get('business.email') ?: null,
                'address' => Setting::get('business.address') ?: null,
                'facebook' => Setting::get('business.social_facebook') ?: null,
                'instagram' => Setting::get('business.social_instagram') ?: null,
                'hours' => $this->openingHoursSummary(),
                'whatsapp_url' => 'https://wa.me/' . preg_replace('/\D/', '', (string) (Setting::get('business.phone') ?: '+92 305 9833859')),
                'directions_url' => app(\App\Services\SeoService::class)->findUs()['mapsUrl'],
                'service_categories' => $this->footerServiceCategories(),
            ],
            // Same constants the server password rule uses: the register checklist reads these.
            'passwordPolicy' => PasswordPolicy::forFrontend(),
            // Sidebar badge: rows with status "new" on the Follow-ups page (admin pages only; never public props).
            'followUpsNew' => fn () => ($request->user() && $request->is('admin*') && $request->user()->can('bookings.manage'))
                ? \App\Http\Controllers\Admin\FollowUpsController::newCount() : 0,
            // Floating WhatsApp popup (admin Settings > WhatsApp popup); defaults match the admin form.
            'wa_popup' => fn () => [
                'enabled' => Setting::get('wa_popup.enabled') !== false,
                'message' => mb_substr(trim((string) Setting::get('wa_popup.message')) ?: 'Need help choosing a service or booking? Chat with us on WhatsApp.', 0, 140),
                'delay' => min(60, max(3, (int) (Setting::get('wa_popup.delay') ?: 8))),
                'sound' => Setting::get('wa_popup.sound') !== false,
            ],
        ];
    }

    /** Active service categories for the footer; empty (never an error) if the table is unavailable. */
    private function footerServiceCategories(): array
    {
        try {
            return \App\Models\ServiceCategory::active()->ordered()->get(['id', 'name'])
                ->map(fn ($c) => ['id' => $c->id, 'name' => $c->name])->all();
        } catch (\Throwable) {
            return [];
        }
    }

    public function handle(Request $request, \Closure $next)
    {
        // Page history kept by the browser is encrypted (needs HTTPS or localhost); cleared on logout.
        Inertia::encryptHistory();

        return parent::handle($request, $next);
    }

    private function defaultOgImage(): ?string
    {
        $path = Setting::get('business.logo_path');

        return is_string($path) && $path !== '' ? asset("storage/{$path}") : null;
    }

    /**
     * Collapses the 7 `business_hours` rows into the shortest honest human-readable summary —
     * "Monday – Sunday: 10:00 AM – 9:00 PM" when every open day shares one window, otherwise one
     * line per distinct window (e.g. "Monday – Saturday", "Sunday") so an irregular schedule is
     * never flattened into a single misleading claim. Returns an empty list when no hours are
     * configured, so the footer renders nothing rather than a fabricated default.
     *
     * @return list<array{days: string, hours: string}>
     */
    public function openingHoursSummary(): array
    {
        return Cache::remember('business:hours-summary', 300, function (): array {
            $hours = BusinessHour::orderBy('weekday')->get();

            if ($hours->isEmpty()) {
                return [];
            }

            $dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

            // Group consecutive weekdays that share the same open/close window. Weeks are indexed
            // Sunday-first in the table, but salons read Monday-first, so rotate before grouping.
            $ordered = $hours->sortBy(fn (BusinessHour $hour) => ($hour->weekday + 6) % 7)->values();

            $groups = [];

            foreach ($ordered as $hour) {
                $window = $hour->is_closed
                    ? 'Closed'
                    : $this->formatTime($hour->open_time) . ' – ' . $this->formatTime($hour->close_time);

                $last = count($groups) - 1;

                if ($last >= 0 && $groups[$last]['window'] === $window) {
                    $groups[$last]['end'] = $dayNames[$hour->weekday];

                    continue;
                }

                $groups[] = [
                    'start' => $dayNames[$hour->weekday],
                    'end' => $dayNames[$hour->weekday],
                    'window' => $window,
                ];
            }

            return array_map(fn (array $group) => [
                'days' => $group['start'] === $group['end']
                    ? $group['start']
                    : "{$group['start']} – {$group['end']}",
                'hours' => $group['window'],
            ], $groups);
        });
    }

    private function formatTime(?string $time): string
    {
        if (! $time) {
            return '';
        }

        // MySQL hands a TIME column back normalised to `H:i:s`, but SQLite returns whatever string
        // was written (usually `H:i`), so a fixed `createFromFormat('H:i:s')` throws "Not enough
        // data available to satisfy format" on the test connection. Parse the parts instead of
        // assuming either shape.
        [$hours, $minutes] = array_pad(explode(':', $time), 2, '00');

        return Carbon::createFromTime((int) $hours, (int) $minutes)->format('g:i A');
    }
}
