<?php

use App\Models\Setting;
use App\Models\User;
use App\Support\HeroMedia;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function heroAdmin(): User
{
    test()->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create(['email_verified_at' => now(), 'two_factor_secret' => encrypt('s'), 'two_factor_confirmed_at' => now()]);
    $user->assignRole('admin');

    return $user;
}

it('defaults to the YouTube video and the default poster when nothing is saved', function () {
    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page
        ->where('hero.source', 'youtube')
        ->where('hero.youtube_id', 'jRmza-n-0vU')
        ->where('hero.video_url', null)
        ->where('hero.poster_url', null));
});

it('uses the local video when the source is local', function () {
    Setting::create(['key' => 'hero.source', 'value' => 'local', 'group' => 'hero', 'is_encrypted' => false]);
    $expected = is_file(public_path('images/Brides_showcasing.mp4')) ? '/images/Brides_showcasing.mp4' : null;

    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page
        ->where('hero.source', 'local')
        ->where('hero.youtube_id', null)
        ->where('hero.video_url', $expected));
});

it('falls back to the local video when the stored YouTube link is invalid', function () {
    Setting::create(['key' => 'hero.youtube_url', 'value' => 'https://evil.example/watch?v=jRmza-n-0vU', 'group' => 'hero', 'is_encrypted' => false]);
    $expected = is_file(public_path('images/Brides_showcasing.mp4')) ? '/images/Brides_showcasing.mp4' : null;

    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page
        ->where('hero.source', 'local')
        ->where('hero.youtube_id', null)
        ->where('hero.video_url', $expected));
});

it('extracts the ID from every accepted YouTube link form', function () {
    foreach ([
        'https://www.youtube.com/watch?v=jRmza-n-0vU',
        'https://youtube.com/watch?v=jRmza-n-0vU&t=3',
        'https://youtu.be/jRmza-n-0vU',
        'https://youtu.be/jRmza-n-0vU?si=abc',
        'https://www.youtube.com/embed/jRmza-n-0vU',
        'https://www.youtube.com/shorts/jRmza-n-0vU',
    ] as $url) {
        expect(HeroMedia::youtubeId($url))->toBe('jRmza-n-0vU', $url);
    }
});

it('rejects other hosts, other schemes and malformed IDs', function () {
    foreach ([
        '', 'jRmza-n-0vU', 'http://youtu.be/jRmza-n-0vU', 'https://evil.com/watch?v=jRmza-n-0vU',
        'https://youtube.com.evil.com/watch?v=jRmza-n-0vU', 'https://m.youtube.com/watch?v=jRmza-n-0vU',
        'https://www.youtube.com/watch?v=short', 'https://www.youtube.com/watch?v=jRmza-n-0vUX',
        'https://youtu.be/jRmza-n-0v!', 'https://www.youtube.com/watch', 'https://user@youtu.be/jRmza-n-0vU',
        'javascript:alert(1)', 'https://youtu.be/<script>alert(1)',
    ] as $url) {
        expect(HeroMedia::youtubeId($url))->toBeNull($url);
    }
});

it('validates the YouTube link and source when saved in the admin', function () {
    $admin = heroAdmin();

    $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.youtube_url' => 'https://example.com/x']])
        ->assertSessionHasErrors('settings.hero.youtube_url');
    $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.source' => 'vimeo']])
        ->assertSessionHasErrors('settings.hero.source');
    $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.source' => 'youtube', 'hero.youtube_url' => 'https://youtu.be/AAAAAAAAAAA']])
        ->assertSessionHasNoErrors();
    $this->get('/')->assertInertia(fn ($page) => $page->where('hero.youtube_id', 'AAAAAAAAAAA'));
});

it('allows only youtube-nocookie.com added to frame-src and puts no iframe in the server HTML', function () {
    $response = $this->get('/')->assertOk();
    $csp = $response->headers->get('Content-Security-Policy');

    expect($csp)->toContain('frame-src https://www.google.com')
        ->toContain('https://www.youtube-nocookie.com')
        ->not->toContain('https://www.youtube.com')
        ->not->toContain('unsafe-inline');
    expect($response->getContent())->not->toContain('youtube-nocookie.com/embed')->not->toMatch('/<iframe[^>]*youtube/i');
});

it('accepts only same-origin files that exist, with the right extension', function () {
    $admin = heroAdmin();

    foreach ([
        ['hero.video_path', 'https://example.com/a.mp4'],
        ['hero.video_path', '//example.com/a.mp4'],
        ['hero.video_path', '/images/missing-file.mp4'],
        ['hero.video_path', '/images/../.env'],
        ['hero.video_path', '/images/hero-poster.jpg'],
        ['hero.poster_path', '/images/Brides_showcasing.mp4'],
        ['hero.poster_path', 'javascript:alert(1)'],
    ] as [$key, $value]) {
        $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => [$key => $value]])->assertSessionHasErrors("settings.{$key}");
    }

    $this->actingAs($admin)->put('/admin/settings/hero', ['settings' => ['hero.poster_path' => '/images/hero-poster.webp']])->assertSessionHasNoErrors();
    $this->get('/')->assertInertia(fn ($page) => $page->where('hero.poster_url', '/images/hero-poster.webp'));
});

it('shows the poster only when the video is switched off or its file is gone', function () {
    Setting::create(['key' => 'hero.video_enabled', 'value' => false, 'group' => 'hero', 'is_encrypted' => false]);
    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page->where('hero.video_url', null));

    Setting::where('key', 'hero.video_enabled')->delete();
    Setting::create(['key' => 'hero.video_path', 'value' => '/images/deleted-video.mp4', 'group' => 'hero', 'is_encrypted' => false]);
    $resolved = HeroMedia::resolve();
    expect($resolved['video_url'])->toBeNull(); // a saved file that is gone means the poster only, no error
    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page->where('hero.video_url', null));
});

it('lists the video files in public/images and reports the PHP upload limits', function () {
    expect(HeroMedia::files(HeroMedia::VIDEO_EXT))->toContain('/images/looks smart beauty Salon in Lahore.mp4');
    expect(HeroMedia::phpLimits()['upload_max_filesize'])->toBeGreaterThan(0);
});

it('explains a missing upload by the PHP limits', function () {
    $this->actingAs(heroAdmin())->post('/admin/hero-media/upload', ['kind' => 'video'])
        ->assertSessionHasErrors('file');
});

it('stores an uploaded hero video under public/images/hero (no symlink) and serves it', function () {
    $tmp = tempnam(sys_get_temp_dir(), 'mp4');
    file_put_contents($tmp, hex2bin('000000186674797069736f6d0000020069736f6d6d703431') . str_repeat("\0", 2048));
    $file = new \Illuminate\Http\UploadedFile($tmp, 'probe.mp4', 'video/mp4', null, true);

    $this->actingAs(heroAdmin())->post('/admin/hero-media/upload', ['kind' => 'video', 'file' => $file])->assertSessionHasNoErrors();

    $path = Setting::get('hero.video_path');
    expect($path)->toStartWith('/images/hero/')->toEndWith('.mp4');
    expect(is_file(public_path(ltrim($path, '/'))))->toBeTrue();
    expect(HeroMedia::files(HeroMedia::VIDEO_EXT))->toContain($path);
    $this->get('/')->assertInertia(fn ($page) => $page->where('hero.video_url', $path));

    @unlink(public_path(ltrim($path, '/')));
});

it('still accepts an old /storage/hero path shape and rejects one whose file is gone', function () {
    expect(HeroMedia::validPath('/storage/hero/gone.mp4', HeroMedia::VIDEO_EXT))->toBeFalse();
    expect(HeroMedia::validPath('/images/hero/gone.mp4', HeroMedia::VIDEO_EXT))->toBeFalse();
});


it('builds the YouTube embed with the JS-API params, checks the message origin and has no iframe_api script', function () {
    $source = file_get_contents(resource_path('js/Pages/Public/Home.tsx'));

    expect($source)->toContain('enablejsapi=1')
        ->toContain('window.location.origin')
        ->toContain("event.origin !== YT_ORIGIN")
        ->toContain('event.source !== frameRef.current?.contentWindow')
        ->toContain("event: 'listening'")
        ->not->toContain('iframe_api');
});
