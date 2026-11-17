<?php

namespace App\Http\Controllers\Admin;

use App\Http\Controllers\Controller;
use App\Models\BusinessHour;
use App\Models\Deal;
use App\Models\Setting;
use App\Services\SecureUploadService;
use App\Services\SettingService;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Inertia\Response;

class SettingController extends Controller
{
    private const GROUPS = ['business', 'booking', 'payments', 'integrations', 'seo', 'deals_bar', 'wa_popup', 'analytics', 'security', 'showcase', 'hero', 'theme'];

    public function index(): Response
    {
        $this->authorize('viewAny', Setting::class);

        $settingService = app(SettingService::class);

        return Inertia::render('Admin/CMS/Settings/Index', [
            'settings' => collect(self::GROUPS)->mapWithKeys(
                fn (string $group) => [$group => $settingService->maskedGroup($group)],
            ),
            'businessHours' => BusinessHour::orderBy('weekday')->get(['weekday', 'open_time', 'close_time', 'is_closed']),
            // For the Deals Bar's "Claim" button: which live deal it adds to the booking.
            'dealOptions' => Deal::active()->orderBy('title')->get(['id', 'title']),
            // Home hero tab: files already in public/images, the PHP upload limits, and the defaults.
            'heroMedia' => [
                'videos' => \App\Support\HeroMedia::files(\App\Support\HeroMedia::VIDEO_EXT),
                'posters' => \App\Support\HeroMedia::files(\App\Support\HeroMedia::POSTER_EXT),
                'limits' => \App\Support\HeroMedia::phpLimits(),
                'defaultVideo' => \App\Support\HeroMedia::DEFAULT_VIDEO,
                'defaultPoster' => \App\Support\HeroMedia::DEFAULT_POSTER,
            ],
        ]);
    }

    public function updateGroup(Request $request, string $group, SettingService $settingService): RedirectResponse
    {
        abort_unless(in_array($group, self::GROUPS, true), 404);

        // The Home showcase and hero media belong to the content team (cms.manage); the rest needs settings.manage.
        if (in_array($group, ['showcase', 'hero'], true)) {
            abort_unless($request->user()?->can('cms.manage'), 403);
        } else {
            $this->authorize('create', Setting::class);
        }

        $data = $request->validate(['settings' => ['required', 'array']]);
        $this->validateGroupPayload($group, $data['settings']);

        $written = $settingService->updateGroup($group, $data['settings']);

        return back()->with('success', count($written) . ' setting(s) saved. Cache cleared.');
    }

    /**
     * Real, per-key validation against SettingService::SCHEMA — done by hand rather than as Laravel
     * validation rules, because a setting key like `business.name` already contains literal dots, and
     * Laravel's validator treats a dotted rule key (`settings.business.name`) as a NESTED array path
     * (settings -> business -> name), not a flat key containing dots. That collision would silently
     * validate against the wrong (nonexistent) input shape and pass through an empty payload. Throwing
     * a manually-built `ValidationException` sidesteps it entirely while still producing the same
     * `settings.{key}` session-error keys the admin UI expects.
     */
    private function validateGroupPayload(string $group, array $values): void
    {
        $errors = [];

        foreach ($values as $key => $value) {
            $meta = SettingService::SCHEMA[$key] ?? null;

            if (! $meta || $meta['group'] !== $group) {
                $errors["settings.{$key}"] = ["Unknown setting key: {$key}"];

                continue;
            }

            $blank = $value === null || $value === '';

            $valid = match ($meta['type']) {
                'int' => $blank || filter_var($value, FILTER_VALIDATE_INT) !== false,
                'float' => $blank || is_numeric($value),
                'bool' => true,
                default => is_scalar($value) && mb_strlen((string) $value) <= 2048,
            };

            if ($valid && $key === 'business.email' && ! $blank && ! filter_var($value, FILTER_VALIDATE_EMAIL)) {
                $valid = false;
            }

            // These 2 get embedded directly into an inline <script> template literal (SeoHead.tsx) —
            // format-validating them here isn't just data hygiene, it keeps a malformed value (e.g. a
            // stray quote) from ever being able to break out of that string, on top of catching a
            // simple admin typo before it ships to every public page.
            if ($valid && $key === 'integrations.google_analytics_id' && ! $blank && ! preg_match('/^G-[A-Z0-9]{6,}$/', $value)) {
                $valid = false;
            }

            if ($valid && $key === 'integrations.google_tag_manager_id' && ! $blank && ! preg_match('/^GTM-[A-Z0-9]{5,}$/', $value)) {
                $valid = false;
            }

            // Analytics: a GTM container id or a GA4 measurement id; it is written into a script URL.
            if ($valid && $key === 'analytics.gtm_id' && ! $blank
                && ! preg_match(\App\Support\Analytics::GTM_PATTERN, (string) $value)
                && ! preg_match(\App\Support\Analytics::GA_PATTERN, (string) $value)) {
                $valid = false;
            }

            // Customer reschedule lead time: 0 (no limit) to 720 hours.
            if ($valid && $key === 'booking.reschedule_min_hours' && ! $blank && ((int) $value < 0 || (int) $value > 720)) {
                $valid = false;
            }

            // Cancellation sentence shown to customers: plain text, at most 300 characters.
            if ($valid && $key === 'booking.cancel_policy_text' && ! $blank
                && (mb_strlen((string) $value) > 300 || strip_tags((string) $value) !== (string) $value)) {
                $valid = false;
            }

            // The countdown end is a datetime-local value ("2026-12-31T20:00") or empty.
            if ($valid && $key === 'deals_bar.ends_at' && ! $blank && strtotime((string) $value) === false) {
                $valid = false;
            }

            // The claim button link: a site path ("/book") or an https:// URL; nothing else (no javascript:).
            if ($valid && $key === 'deals_bar.claim_url' && ! $blank
                && ! preg_match('#^(/(?!/)[^\s]*|https://[^\s]+)$#i', trim((string) $value))) {
                $valid = false;
            }

            // WhatsApp popup: plain text up to 140 characters; delay 3 to 60 seconds.
            if ($valid && $key === 'wa_popup.message' && ! $blank
                && (mb_strlen((string) $value) > 140 || strip_tags((string) $value) !== (string) $value)) {
                $valid = false;
            }
            if ($valid && $key === 'wa_popup.delay' && ! $blank && ((int) $value < 3 || (int) $value > 60)) {
                $valid = false;
            }

            // Home showcase: plain text with sensible limits; links are a site path or https:// only.
            if ($valid && str_starts_with($key, 'showcase.') && ! $blank) {
                $limits = ['eyebrow' => 80, 'heading_1' => 60, 'heading_2' => 60, 'paragraph' => 300, 'chips_label' => 60, 'deal_label' => 40,
                    'deal_button_label' => 30, 'deal_button_url' => 255, 'primary_label' => 30, 'primary_url' => 255, 'secondary_label' => 30,
                    'secondary_url' => 255, 'trust_1' => 40, 'trust_2' => 40, 'trust_3' => 40, 'card_title' => 30, 'card_line' => 40];
                $name = substr($key, 9);

                if (isset($limits[$name]) && (mb_strlen((string) $value) > $limits[$name] || strip_tags((string) $value) !== (string) $value)) {
                    $valid = false;
                }
                if (str_ends_with($name, '_url') && ! \App\Support\Showcase::validLink((string) $value)) {
                    $valid = false;
                }
                if ($name === 'interval' && ((int) $value < 3 || (int) $value > 15)) {
                    $valid = false;
                }
            }

            // Theme colours: #RRGGBB only (they are written into a stylesheet).
            if ($valid && str_starts_with($key, 'theme.') && ! $blank && ! preg_match('/^#[0-9A-Fa-f]{6}$/', (string) $value)) {
                $valid = false;
            }

            // Hero video / poster: a same-origin path to a file that exists under public/ (no external URLs).
            if ($valid && in_array($key, ['hero.video_path', 'hero.poster_path'], true) && ! $blank
                && ! \App\Support\HeroMedia::validPath((string) $value, $key === 'hero.video_path' ? \App\Support\HeroMedia::VIDEO_EXT : \App\Support\HeroMedia::POSTER_EXT)) {
                $valid = false;
            }

            if (! $valid) {
                $errors["settings.{$key}"] = ["The {$key} field is not a valid {$meta['type']}."];
            }
        }

        if ($errors !== []) {
            throw ValidationException::withMessages($errors);
        }
    }

    public function updateHours(Request $request): RedirectResponse
    {
        $this->authorize('create', Setting::class);

        $data = $request->validate([
            'hours' => ['required', 'array', 'size:7'],
            'hours.*.weekday' => ['required', 'integer', 'min:0', 'max:6'],
            'hours.*.is_closed' => ['boolean'],
            'hours.*.open_time' => ['nullable', 'date_format:H:i'],
            'hours.*.close_time' => ['nullable', 'date_format:H:i'],
        ]);

        foreach ($data['hours'] as $row) {
            $isClosed = $row['is_closed'] ?? false;

            BusinessHour::updateOrCreate(
                ['weekday' => $row['weekday']],
                [
                    'is_closed' => $isClosed,
                    'open_time' => $isClosed ? null : ($row['open_time'] ?? null),
                    'close_time' => $isClosed ? null : ($row['close_time'] ?? null),
                ],
            );
        }

        // The public footer renders a cached summary of these rows on every page
        // (HandleInertiaRequests::openingHoursSummary) — without this the site would keep
        // advertising the old hours for up to 5 minutes after an admin corrects them.
        Cache::forget('business:hours-summary');

        return back()->with('success', 'Operating hours saved.');
    }

    public function uploadLogo(Request $request, SecureUploadService $uploads, SettingService $settingService): RedirectResponse
    {
        $this->authorize('create', Setting::class);

        return $this->uploadBusinessImage($request, $uploads, $settingService, 'logo', 'business.logo_path');
    }

    public function uploadFavicon(Request $request, SecureUploadService $uploads, SettingService $settingService): RedirectResponse
    {
        $this->authorize('create', Setting::class);

        return $this->uploadBusinessImage($request, $uploads, $settingService, 'favicon', 'business.favicon_path');
    }

    private function uploadBusinessImage(Request $request, SecureUploadService $uploads, SettingService $settingService, string $field, string $key): RedirectResponse
    {
        $request->validate([
            $field => ['required', 'image', 'mimes:jpeg,png,webp,gif', 'max:2048'],
        ]);

        $oldPath = $settingService->get($key);
        $path = $uploads->storePublicImage($request->file($field), 'business');
        $settingService->set($key, $path, 'business');
        $uploads->deletePublic(is_string($oldPath) ? $oldPath : null);

        return back()->with('success', ucfirst($field) . ' updated.');
    }
}
