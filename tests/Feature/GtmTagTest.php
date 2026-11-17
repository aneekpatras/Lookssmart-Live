<?php

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

function analyticsSetting(string $key, mixed $value): void
{
    Setting::create(['key' => $key, 'value' => $value, 'group' => 'analytics', 'is_encrypted' => false]);
}

it('puts only the consent-gated loader in the raw HTML, never a Google URL', function () {
    foreach (['/', '/faqs', '/this-page-does-not-exist'] as $url) {
        $html = $this->get($url)->getContent();

        expect(substr_count($html, 'src="/js/consent-analytics.js"'))->toBe(1, $url)
            ->and($html)->toContain('data-kind="gtm" data-id="GTM-WJLPSKGR"')
            ->and($html)->not->toContain('googletagmanager.com')
            ->and($html)->not->toContain('google-analytics.com')
            ->and($html)->not->toContain('gtm-init.js')
            ->and($html)->not->toContain('<noscript><iframe');
    }
});

it('only loads Google after a stored Accept, and never with Do Not Track', function () {
    $js = file_get_contents(public_path('js/consent-analytics.js'));

    expect($js)->toContain("var KEY = 'ls_consent_v1'")
        ->toContain("value.choice === 'accepted'")
        ->toContain('doNotTrack()')
        ->toContain("window.dataLayer.push({ 'gtm.start': new Date().getTime(), event: 'gtm.js' });")
        ->toContain('if (accepted()) load();');
    // The only place a Google URL is built is inside load(), which every path guards with consent / DNT.
    expect(substr_count($js, 'https://www.googletagmanager.com'))->toBe(2);
    expect(strpos($js, 'function load()'))->toBeLessThan(strpos($js, 'https://www.googletagmanager.com/gtm.js'));
});

it('uses the configured container id, escaped', function () {
    analyticsSetting('analytics.gtm_id', 'GTM-ABC1234');

    $html = $this->get('/')->getContent();

    expect($html)->toContain('data-id="GTM-ABC1234"')->not->toContain('GTM-WJLPSKGR');
});

it('hands a G- measurement id to the loader as kind ga', function () {
    analyticsSetting('analytics.gtm_id', 'G-ABCDEF1234');

    $html = $this->get('/')->getContent();

    expect($html)->toContain('data-kind="ga" data-id="G-ABCDEF1234"')->not->toContain('googletagmanager.com');
});

it('outputs nothing when disabled or when the id is invalid', function () {
    analyticsSetting('analytics.enabled', false);
    expect($this->get('/')->getContent())->not->toContain('consent-analytics.js')->not->toContain('googletagmanager.com');

    Setting::where('key', 'analytics.enabled')->delete();
    Setting::flushCache();
    analyticsSetting('analytics.gtm_id', 'not-an-id"><script>');
    expect($this->get('/')->getContent())->not->toContain('consent-analytics.js')->not->toContain('googletagmanager.com');
});

it('does not output the tags on admin pages', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create([
        'email_verified_at' => now(),
        'two_factor_secret' => encrypt('s'),
        'two_factor_confirmed_at' => now(),
    ]);
    $admin->assignRole('super-admin');

    $html = $this->actingAs($admin)->get('/admin/settings')->getContent();
    expect($html)->not->toContain('consent-analytics.js')->not->toContain('googletagmanager.com');

    $csp = $this->actingAs($admin)->get('/admin/settings')->headers->get('Content-Security-Policy');
    expect($csp)->not->toContain('googletagmanager.com');
});

it('sets script-src with Google Tag Manager and no unsafe-inline on a public page', function () {
    $csp = $this->get('/')->headers->get('Content-Security-Policy');
    preg_match('/script-src [^;]+/', $csp, $match);

    expect($match[0])->toContain('https://www.googletagmanager.com')
        ->not->toContain('unsafe-inline')
        ->not->toContain('unsafe-eval');
    expect($csp)->toContain('https://stats.g.doubleclick.net')->toContain('https://*.analytics.google.com');
});

it('falls back to no tag, without throwing, when the settings table is unavailable', function () {
    Schema::drop('settings');
    Setting::flushCache();

    expect(\App\Support\Analytics::tag())->toBeNull();
});

it('saves the Analytics settings and rejects a bad container id', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create([
        'email_verified_at' => now(),
        'two_factor_secret' => encrypt('s'),
        'two_factor_confirmed_at' => now(),
    ]);
    $admin->assignRole('super-admin');

    $this->actingAs($admin)->put('/admin/settings/analytics', [
        'settings' => ['analytics.enabled' => 'false', 'analytics.gtm_id' => 'GTM-ABC1234'],
    ])->assertSessionHasNoErrors();
    expect(Setting::get('analytics.gtm_id'))->toBe('GTM-ABC1234');

    $this->actingAs($admin)->put('/admin/settings/analytics', [
        'settings' => ['analytics.gtm_id' => 'GTM-"><x'],
    ])->assertSessionHasErrors('settings.analytics.gtm_id');
});


it('shows the cookie banner on public pages only, with Accept/Decline, a privacy link and a footer reopen link', function () {
    $banner = file_get_contents(resource_path('js/Components/CookieBanner.tsx'));
    $public = file_get_contents(resource_path('js/Layouts/PublicLayout.tsx'));
    $admin = file_get_contents(resource_path('js/Layouts/AdminLayout.tsx'));

    expect($public)->toContain('<CookieBanner />')->toContain('Cookie settings')->toContain('openCookieSettings');
    expect($admin)->not->toContain('CookieBanner');
    expect($banner)->toContain("const KEY = 'ls_consent_v1'")
        ->toContain('We use essential cookies to run the site, and optional analytics cookies to improve it.')
        ->toContain('href="/privacy-policy"')
        ->toContain('Accept')->toContain('Decline')
        ->toContain('12 months'); // re-asked after a year
    // The Inertia pages for admin and auth never use PublicLayout.
    expect(file_get_contents(resource_path('js/Layouts/AuthLayout.tsx')))->not->toContain('CookieBanner');
});

it('tells the banner whether analytics is active, and mentions it in the Privacy Policy', function () {
    $this->get('/')->assertInertia(fn ($page) => $page->where('analytics.enabled', true));

    analyticsSetting('analytics.enabled', false);
    $this->get('/')->assertInertia(fn ($page) => $page->where('analytics.enabled', false));

    expect(file_get_contents(resource_path('js/Pages/Public/PrivacyPolicy.tsx')))->toContain('cookie banner');
});
