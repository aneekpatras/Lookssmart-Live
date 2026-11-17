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

    $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.source' => 'local', 'hero.video_path' => $video, 'hero.poster_path' => '/images/hero-poster.webp']])->assertSessionHasNoErrors();

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
    $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.source' => 'local', 'hero.video_path' => '/images/Brides_showcasing.mp4']])->assertSessionHasNoErrors();
    $this->get('/')->assertInertia(fn ($page) => $page->where('hero.video_url', '/images/Brides_showcasing.mp4'));

    if (is_file(public_path('images/Untitled design - Video.mp4'))) {
        $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.source' => 'local', 'hero.video_path' => '/images/Untitled design - Video.mp4']])->assertSessionHasNoErrors();
        $this->get('/')->assertInertia(fn ($page) => $page->where('hero.video_url', '/images/Untitled%20design%20-%20Video.mp4'));
    }
});

it('links the theme stylesheet after the app CSS for a guest and for a signed-in admin, and shares its version', function () {
    $html = $this->get('/')->getContent();
    expect($html)->toContain('id="theme-css"')->toContain('/theme.css?v=');
    expect(strrpos($html, 'build/assets/app-'))->toBeLessThan(strpos($html, '/theme.css?v='));

    $admin = applyAdmin();
    $this->actingAs($admin)->put('/admin/settings/theme', ['settings' => ['theme.gold' => '#2f7a62']])->assertSessionHasNoErrors();

    $adminHtml = $this->actingAs($admin)->get('/')->getContent();
    expect($adminHtml)->toContain('id="theme-css"');
    $this->actingAs($admin)->get('/')->assertInertia(fn ($page) => $page->where('themeVersion', \App\Support\Theme::version()));
    $this->actingAs($admin)->get('/admin/settings')->assertDontSee('id="theme-css"', false);
});

it('keeps the old brand hex literals out of the public components and the built CSS', function () {
    $brand = '/#c9a66b|#b8935a|#8a6a35|#f3e8d2|#fbf5e8|#2a2420|#faf7f2|201[ ,_]+166[ ,_]+107|42[ ,_]+36[ ,_]+32/i';
    $found = [];

    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator(resource_path('js'), FilesystemIterator::SKIP_DOTS)) as $file) {
        $path = str_replace(DIRECTORY_SEPARATOR, '/', $file->getPathname());

        if (! preg_match('/\.tsx?$/', $path) || preg_match('#/(Pages/Admin|Components/admin)/#', $path)) {
            continue;
        }

        foreach (file($path) as $n => $line) {
            // Comments may mention the default shades; only real class names and style values count.
            if (preg_match($brand, $line) && ! preg_match('#^\s*(\*|//|/\*)#', $line)) {
                $found[] = basename($path) . ':' . ($n + 1);
            }
        }
    }
    expect($found)->toBe([]);

    foreach (glob(public_path('build/assets/app-*.css')) ?: [] as $built) {
        // Only the three default base colours (inside @layer base) may remain.
        $css = preg_replace('/:root\{--gold:#c9a66b;--espresso:#2a2420;--ivory:#faf7f2\}/', '', file_get_contents($built));
        expect(preg_match_all('/#c9a66b|#2a2420|#faf7f2/i', $css))->toBe(0);
    }
});

it('declares the default brand colours only inside a cascade layer, and /theme.css beats them with :root:root', function () {
    $src = file_get_contents(resource_path('css/app.css'));
    expect($src)->toMatch('/@layer base \{\s*:root \{\s*--gold: #c9a66b;/');
    expect(preg_match('/^:root \{\s*--gold/m', $src))->toBe(0);

    foreach (glob(public_path('build/assets/app-*.css')) ?: [] as $built) {
        $css = file_get_contents($built);
        $at = strpos($css, '--gold:#c9a66b');
        expect($at)->not->toBeFalse();
        // Walk the braces before the declaration: the enclosing at-rule must be @layer.
        $depth = 0;
        $stack = [];
        for ($i = 0; $i < $at; $i++) {
            if ($css[$i] === '{') {
                $start = max((int) strrpos(substr($css, 0, $i), '}'), (int) strrpos(substr($css, 0, $i), ';'));
                $stack[] = trim(substr($css, $start + ($start ? 1 : 0), $i - $start - ($start ? 1 : 0)));
            } elseif ($css[$i] === '}') {
                array_pop($stack);
            }
        }
        expect(implode(' > ', $stack))->toStartWith('@layer');
    }

    $admin = applyAdmin();
    $this->actingAs($admin)->put('/admin/settings/theme', ['settings' => ['theme.gold' => '#2f7a62', 'theme.espresso' => '#1d2a26', 'theme.ivory' => '#f6f8f5']])->assertSessionHasNoErrors();
    $this->get('/theme.css')->assertSee(':root:root {', false)->assertSee('--gold: #2f7a62;', false)->assertSee('--espresso: #1d2a26;', false)->assertSee('--ivory: #f6f8f5;', false);
});
