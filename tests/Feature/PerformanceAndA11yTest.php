<?php

use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

it('shares the Search Console verification value on a public page once configured, and no analytics ids', function () {
    Setting::create(['key' => 'integrations.google_site_verification', 'value' => 'real-verification-token', 'group' => 'integrations', 'is_encrypted' => false]);

    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page
        ->where('seo.gscVerification', 'real-verification-token')
        ->missing('seo.gtmId')
        ->missing('seo.ga4Id'));
});

it('shares a null Search Console value when none is configured, never a fabricated placeholder', function () {
    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page->where('seo.gscVerification', null));
});

it('keeps the locked-down CSP unchanged when analytics is switched off', function () {
    Setting::create(['key' => 'analytics.enabled', 'value' => false, 'group' => 'analytics', 'is_encrypted' => false]);

    $csp = $this->get('/')->headers->get('Content-Security-Policy');

    // `frame-src` is deliberately NOT `'none'`: the Contact page's keyless Google Maps embed needs
    // `https://www.google.com`. The analytics-only loosening must be absent here.
    expect($csp)->not->toContain('googletagmanager.com')
        ->not->toContain('google-analytics.com')
        ->not->toContain('strict-dynamic')
        ->toContain('frame-src https://www.google.com')
        ->toContain("frame-ancestors 'none'")
        ->not->toContain('unsafe-inline');
});

it('loosens only script/frame/img/connect-src to the Google domains while the tag is active', function () {
    $csp = $this->get('/')->headers->get('Content-Security-Policy');

    expect($csp)->toContain("script-src 'self' 'nonce-")
        ->toContain('https://www.googletagmanager.com')
        ->not->toContain("'strict-dynamic'")
        ->toContain('frame-src https://www.google.com https://www.googletagmanager.com')
        ->toContain('https://www.google-analytics.com')
        ->toContain("frame-ancestors 'none'")
        ->not->toContain('unsafe-inline');
});

it('returns a valid manifest.json with square app icons, any and maskable as separate entries', function () {
    $response = $this->get('/manifest.json');

    $response->assertOk();
    $response->assertHeader('Content-Type', 'application/manifest+json');

    $manifest = $response->json();

    expect($manifest['name'])->toBe('Looks Smart')
        ->and($manifest['short_name'])->toBe('Looks Smart')
        ->and($manifest['display'])->toBe('standalone')
        ->and($manifest['start_url'])->toBe('/')
        ->and($manifest['background_color'])->toBe('#faf7f2')
        ->and($manifest['theme_color'])->toBe('#c9a66b');

    $icons = collect($manifest['icons']);
    expect($icons)->toHaveCount(4)
        ->and($icons->where('purpose', 'any')->pluck('sizes')->all())->toBe(['192x192', '512x512'])
        ->and($icons->where('purpose', 'maskable')->pluck('sizes')->all())->toBe(['192x192', '512x512']);
});

it('never lists the wide business logo as a manifest icon', function () {
    Storage::fake('public');
    Storage::disk('public')->put('business/logo.png', 'fake-real-png-bytes');
    Setting::create(['key' => 'business.logo_path', 'value' => 'business/logo.png', 'group' => 'business', 'is_encrypted' => false]);

    expect($this->get('/manifest.json')->json('icons'))->toHaveCount(4);
});

/**
 * `loading`/`decoding` are attributes on React elements that only exist in the DOM once Inertia SSR
 * (or client hydration) actually renders them — this repo has no Vitest/RTL setup yet (confirmed: no
 * vitest config or *.test.tsx files exist), so there's no in-process way to render a React component
 * and assert its real DOM output the way the rest of this suite asserts real HTTP/DB behavior. These
 * are therefore deliberate source-presence checks, not DOM-rendering assertions — documented as such
 * rather than silently passed off as more than they are. They still catch a real regression: if
 * `Picture.tsx`'s defaults are ever removed, these fail.
 */
it('defaults the shared Picture component to lazy loading and async decoding', function () {
    $source = file_get_contents(base_path('resources/js/Components/Picture.tsx'));

    expect($source)->toContain("loading = 'lazy'")
        ->toContain("decoding = 'async'");
});

it('keeps explicit lazy/async attributes on every retrofitted public gallery/blog image', function () {
    // MasonryGrid/BeforeAfterSlider aren't listed here — they now render through the shared
    // `Picture` component (covered by the test above) rather than a raw <img> of their own.
    $files = [
        'resources/js/Pages/Public/Blog.tsx',
        'resources/js/Pages/Public/BlogDetail.tsx',
        'resources/js/Pages/Public/About.tsx',
        'resources/js/Pages/Public/Home.tsx',
        'resources/js/Pages/Public/Services.tsx',
        'resources/js/Pages/Public/ServiceDetail.tsx',
    ];

    foreach ($files as $file) {
        $source = file_get_contents(base_path($file));

        expect($source)->toContain('decoding="async"');
    }
});
