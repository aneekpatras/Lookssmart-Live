<?php

use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function applyAdmin(): User
{
    test()->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create(['email_verified_at' => now(), 'two_factor_secret' => encrypt('s'), 'two_factor_confirmed_at' => now()]);
    $user->assignRole('super-admin');

    return $user;
}

function themeLinkVersion(string $html): ?string
{
    return preg_match('#/theme\.css\?v=([^"\']+)#', $html, $m) ? $m[1] : null;
}

it('applies a saved theme colour end to end: row, /theme.css, versioned link', function () {
    $admin = applyAdmin();
    $before = themeLinkVersion($this->get('/')->getContent());

    $this->actingAs($admin)->put('/admin/settings/theme', ['settings' => ['theme.gold' => '#b76e79']])->assertSessionHasNoErrors();
    expect(Setting::where('key', 'theme.gold')->first()->value)->toBe('#b76e79');

    $this->get('/theme.css')->assertOk()->assertSee('#b76e79', false);

    $after = themeLinkVersion($this->get('/')->getContent());
    expect($after)->not->toBeNull()->not->toBe($before);

    // Saved again within the same second: the link version must still change, and so must the stylesheet.
    $this->actingAs($admin)->put('/admin/settings/theme', ['settings' => ['theme.gold' => '#112233']])->assertSessionHasNoErrors();
    expect(themeLinkVersion($this->get('/')->getContent()))->not->toBe($after);
    $this->get('/theme.css')->assertSee('#112233', false)->assertDontSee('#b76e79', false);
});

it('revalidates the stylesheet on every load instead of caching it for an hour', function () {
    $cc = $this->get('/theme.css')->headers->get('Cache-Control');
    expect($cc)->toContain('max-age=0')->toContain('must-revalidate');
});

it('applies a saved hero video and poster to the Home props', function () {
    $admin = applyAdmin();
    $video = '/images/' . basename(\App\Support\HeroMedia::files(\App\Support\HeroMedia::VIDEO_EXT)[0]);

    $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.video_path' => $video, 'hero.poster_path' => '/images/hero-poster.webp']])->assertSessionHasNoErrors();

    $this->get('/')->assertInertia(fn ($page) => $page
        ->where('hero.video_url', implode('/', array_map('rawurlencode', explode('/', $video))))
        ->where('hero.poster_url', '/images/hero-poster.webp'));
});

it('still rejects an invalid colour and leaves the stored value alone', function () {
    $admin = applyAdmin();
    $this->actingAs($admin)->put('/admin/settings/theme', ['settings' => ['theme.gold' => '#b76e79']]);
    $this->actingAs($admin)->put('/admin/settings/theme', ['settings' => ['theme.gold' => 'red']])->assertSessionHasErrors('settings.theme.gold');
    expect(Setting::where('key', 'theme.gold')->first()->value)->toBe('#b76e79');
});

it('keeps the utility colour tokens wired to the theme variables in the source and the built CSS', function () {
    $css = file_get_contents(resource_path('css/app.css'));
    expect($css)->toContain('--color-ivory: var(--ivory)')->toContain('--color-ink: var(--espresso)')->toContain('--color-accent-500: var(--gold)');

    foreach (glob(public_path('build/assets/app-*.css')) ?: [] as $built) {
        $min = file_get_contents($built);
        expect($min)->toContain('--color-accent-500:var(--gold)')->toContain('--color-ivory:var(--ivory)')->toContain('--color-ink:var(--espresso)');
    }
});

it('renders the saved hero video as the Home hero prop with spaces encoded', function () {
    $admin = applyAdmin();
    $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.video_path' => '/images/Brides_showcasing.mp4']])->assertSessionHasNoErrors();
    $this->get('/')->assertInertia(fn ($page) => $page->where('hero.video_url', '/images/Brides_showcasing.mp4'));

    if (is_file(public_path('images/Untitled design - Video.mp4'))) {
        $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.video_path' => '/images/Untitled design - Video.mp4']])->assertSessionHasNoErrors();
        $this->get('/')->assertInertia(fn ($page) => $page->where('hero.video_url', '/images/Untitled%20design%20-%20Video.mp4'));
    }
});
