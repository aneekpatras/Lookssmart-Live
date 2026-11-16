<?php

use App\Models\Setting;
use App\Models\User;
use App\Support\Theme;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

function themeAdmin(): User
{
    test()->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create(['email_verified_at' => now(), 'two_factor_secret' => encrypt('s'), 'two_factor_confirmed_at' => now()]);
    $user->assignRole('super-admin');

    return $user;
}

function saveTheme(array $colours)
{
    return test()->actingAs(themeAdmin())->put('/admin/settings/theme', ['settings' => collect($colours)->mapWithKeys(fn ($v, $k) => ["theme.{$k}" => $v])->all()]);
}

it('serves an empty default stylesheet with cache headers when nothing is saved', function () {
    $response = $this->get('/theme.css')->assertOk();

    expect($response->headers->get('Content-Type'))->toContain('text/css');
    expect($response->headers->get('Cache-Control'))->toContain('public')->toContain('max-age=3600');
    expect($response->headers->get('ETag'))->not->toBeNull();
    expect($response->getContent())->not->toContain('--gold:');

    $this->withHeaders(['If-None-Match' => $response->headers->get('ETag')])->get('/theme.css')->assertStatus(304);
});

it('serves the saved colours with derived shades and static fallbacks', function () {
    saveTheme(['gold' => '#b76e79', 'espresso' => '#2d1f21', 'ivory' => '#fbf6f4'])->assertSessionHasNoErrors();

    $css = $this->get('/theme.css')->assertOk()->getContent();

    expect($css)->toContain('--gold: #b76e79;')->toContain('--espresso: #2d1f21;')->toContain('--ivory: #fbf6f4;');
    // A static fallback comes right before each color-mix() declaration.
    expect($css)->toMatch('/--color-accent-600: #[0-9a-f]{6};\n  --color-accent-600: color-mix\(in srgb, var\(--gold\) 85%, black\);/');
});

it('returns to the empty stylesheet when the defaults are saved again', function () {
    saveTheme(['gold' => '#b76e79']);
    saveTheme(['gold' => '#c9a66b', 'espresso' => '#2a2420', 'ivory' => '#faf7f2']);

    expect($this->get('/theme.css')->getContent())->not->toContain('--gold:');
});

it('rejects invalid hex colours', function () {
    foreach (['red', '#fff', '#12345g', 'rgb(0,0,0)', '#c9a66b; } body { display:none', '#c9a66b80'] as $bad) {
        saveTheme(['gold' => $bad])->assertSessionHasErrors('settings.theme.gold');
    }
    expect(Setting::where('key', 'theme.gold')->exists())->toBeFalse();
});

it('changes the version query in the page head when the theme is saved', function () {
    $version = function () {
        preg_match('#/theme\.css\?v=(\d+)#', $this->get('/about')->getContent(), $m);

        return $m[1] ?? null;
    };

    expect($version())->toBe('0');

    saveTheme(['gold' => '#b76e79']);
    $first = $version();
    expect((int) $first)->toBeGreaterThan(0);

    $this->travel(5)->seconds();
    saveTheme(['gold' => '#2f7a62']);
    expect($version())->not->toBe($first);
});

it('does not link the theme stylesheet on admin pages', function () {
    $this->actingAs(themeAdmin())->get('/admin/settings')->assertOk()->assertDontSee('/theme.css', false);
});

it('still serves the stylesheet, and the theme helpers do not throw, when the settings table is unavailable', function () {
    Schema::drop('settings');

    expect(Theme::values())->toBe(Theme::DEFAULTS);
    expect(Theme::version())->toBe(0);
    expect(Theme::css())->toContain('Default theme');
    $this->get('/theme.css')->assertOk();
});
