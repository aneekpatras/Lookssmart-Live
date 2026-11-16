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

const GTM_SRC = 'https://www.googletagmanager.com/gtm.js?id=GTM-WJLPSKGR';

it('puts the init script and the GTM script in the raw HTML of public pages and 404s, once each', function () {
    foreach (['/', '/faqs', '/this-page-does-not-exist'] as $url) {
        $html = $this->get($url)->getContent();

        expect(substr_count($html, 'src="/js/gtm-init.js"'))->toBe(1, $url)
            ->and(substr_count($html, GTM_SRC))->toBe(1, $url)
            ->and(strpos($html, '/js/gtm-init.js'))->toBeLessThan(strpos($html, GTM_SRC))
            ->and(strpos($html, GTM_SRC))->toBeLessThan(strpos($html, '</head>'));
    }
});

it('has the standard gtm.start line in gtm-init.js', function () {
    $js = file_get_contents(public_path('js/gtm-init.js'));

    expect($js)->toContain('window.dataLayer = window.dataLayer || []')
        ->toContain("gtag('js', new Date())")
        ->toContain("window.dataLayer.push({'gtm.start': new Date().getTime(), event: 'gtm.js'});");
});

it('uses the configured container id, escaped', function () {
    analyticsSetting('analytics.gtm_id', 'GTM-ABC1234');

    $html = $this->get('/')->getContent();

    expect($html)->toContain('gtm.js?id=GTM-ABC1234')->not->toContain('GTM-WJLPSKGR" ');
});

it('loads gtag.js and the config file for a G- measurement id, with no inline script', function () {
    analyticsSetting('analytics.gtm_id', 'G-ABCDEF1234');

    $html = $this->get('/')->getContent();

    expect($html)->toContain('https://www.googletagmanager.com/gtag/js?id=G-ABCDEF1234')
        ->toContain('src="/js/gtag-config.js" data-ga-id="G-ABCDEF1234"')
        ->not->toContain('gtm.js?id=');
});

it('outputs nothing when disabled or when the id is invalid', function () {
    analyticsSetting('analytics.enabled', false);
    expect($this->get('/')->getContent())->not->toContain('gtm-init.js')->not->toContain('googletagmanager.com');

    Setting::where('key', 'analytics.enabled')->delete();
    Setting::flushCache();
    analyticsSetting('analytics.gtm_id', 'not-an-id"><script>');
    expect($this->get('/')->getContent())->not->toContain('gtm-init.js')->not->toContain('googletagmanager.com');
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
    expect($html)->not->toContain('gtm-init.js')->not->toContain('googletagmanager.com');

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
