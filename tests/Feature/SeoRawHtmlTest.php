<?php

use App\Models\Deal;
use App\Models\Post;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/*
 * SEO Phase 1: every public page must carry its title / description / canonical / Open Graph tags and a
 * single <h1> in the RAW HTML the server returns — i.e. before (and without) any JavaScript running —
 * because that is all Google's first pass, Bing and link-preview bots (WhatsApp, Facebook) ever see.
 * These tests read `getContent()` (the literal response body), never the Inertia page object.
 */

function rawHtml($response): string
{
    return $response->getContent();
}

/** Counts occurrences of a literal fragment — used to prove nothing is emitted twice. */
function occurrences(string $html, string $needle): int
{
    return substr_count($html, $needle);
}

dataset('staticPublicPages', [
    'home' => ['/'],
    'services' => ['/services'],
    'deals' => ['/deals'],
    'gallery' => ['/gallery'],
    'blog' => ['/blog'],
    'about' => ['/about'],
    'contact' => ['/contact'],
    'book' => ['/book'],
    'privacy policy' => ['/privacy-policy'],
]);

it('puts title, description, canonical, Open Graph and one h1 in the raw HTML of every public page', function (string $path) {
    $html = rawHtml($this->get($path)->assertOk());

    expect($html)
        ->toMatch('/<title>[^<]{5,}<\/title>/')
        ->toMatch('/<meta name="description" content="[^"]{20,}" data-inertia="description">/')
        ->toMatch('/<link rel="canonical" href="https?:\/\/[^"]+" data-inertia="canonical">/')
        ->toContain('property="og:title"')
        ->toContain('property="og:description"')
        ->toContain('property="og:url"')
        ->toContain('property="og:type"')
        ->toContain('property="og:site_name"')
        ->toContain('name="twitter:card"');

    // Exactly one of each — a second copy would mean the server and browser tags collided.
    expect(occurrences($html, 'name="description"'))->toBe(1)
        ->and(occurrences($html, 'rel="canonical"'))->toBe(1)
        ->and(occurrences($html, '<h1'))->toBe(1)
        ->and(occurrences($html, '<title>'))->toBe(1);
})->with('staticPublicPages');

it('writes a crawlable fallback with real links and removes nothing the app needs', function () {
    $html = rawHtml($this->get('/')->assertOk());

    expect($html)
        ->toContain('<main id="seo-fallback">')
        ->toContain('<h1>Beauty Salon in Central Park Housing Scheme, Lahore</h1>')
        ->toContain('href="' . route('services.index') . '"')
        ->toContain('href="' . route('book') . '"')
        // The Inertia page payload + mount point must still be there.
        ->toContain('data-page="app"')
        ->toContain('<div id="app"></div>');
});

it('uses the service SEO fields and DB price on a service detail page, and canonicalises it', function () {
    $category = ServiceCategory::factory()->create(['name' => 'Hair Styling & Treatments']);
    $service = Service::factory()->create([
        'service_category_id' => $category->id,
        'name' => 'Balayage - Long',
        'slug' => 'balayage-long',
        'seo_title' => 'Balayage Hair Colour',
        'seo_description' => 'Hand-painted balayage highlights for a sun-kissed, low-maintenance look at our Lahore salon.',
        'base_price' => 20000,
        'duration_min' => 150,
    ]);

    $html = rawHtml($this->get('/services/balayage-long?utm_source=x')->assertOk());

    expect($html)
        ->toContain('<title>Balayage Hair Colour | ')
        ->toContain('content="Hand-painted balayage highlights for a sun-kissed, low-maintenance look at our Lahore salon."')
        // Canonical ignores tracking query strings.
        ->toContain('<link rel="canonical" href="' . route('services.show', $service->slug) . '" data-inertia="canonical">')
        ->toContain('<h1>Balayage - Long in Lahore</h1>')
        // Price comes from the database row, formatted — never typed into code.
        ->toContain('Price: PKR 20,000')
        ->toContain('Duration: 150 minutes');
});

it('builds a natural fallback description for services whose description is empty, short or generic', function (?string $description) {
    $category = ServiceCategory::factory()->create(['name' => 'Skin & Facial Care']);
    Service::factory()->create([
        'service_category_id' => $category->id,
        'name' => 'Hydra Facial',
        'slug' => 'hydra-facial',
        'description' => $description,
        'seo_description' => null,
    ]);

    $html = rawHtml($this->get('/services/hydra-facial')->assertOk());

    expect($html)->toMatch('/<meta name="description" content="Hydra Facial \(Skin &amp; Facial Care\) at [^"]*Central Park Housing Scheme, Main Ferozpur Road, Lahore\./');

    // The fallback exists only at render time — the stored row is untouched.
    expect(Service::where('slug', 'hydra-facial')->value('description'))->toBe($description);
})->with([
    'null' => [null],
    'empty string' => [''],
    'too short' => ['Nice.'],
    'generic placeholder' => ['Book Hydra Facial at Looks Smart Beauty Salon.'],
]);

it('keeps a service description that is long enough as-is (with HTML stripped)', function () {
    $category = ServiceCategory::factory()->create();
    Service::factory()->create([
        'service_category_id' => $category->id,
        'slug' => 'face-polisher',
        'name' => 'Face Polisher',
        'description' => '<p>A gentle exfoliating polish that lifts away dull surface cells and leaves skin smoother.</p>',
        'seo_description' => null,
    ]);

    $html = rawHtml($this->get('/services/face-polisher')->assertOk());

    expect($html)->toContain('content="A gentle exfoliating polish that lifts away dull surface cells and leaves skin smoother."');
});

it('escapes hostile characters in names so titles and meta attributes cannot be broken out of', function () {
    $category = ServiceCategory::factory()->create();
    Service::factory()->create([
        'service_category_id' => $category->id,
        'slug' => 'tricky-name',
        'name' => 'Glow "Special" <script>alert(1)</script>',
        'description' => null,
        'seo_description' => null,
    ]);

    $html = rawHtml($this->get('/services/tricky-name')->assertOk());

    expect($html)->not->toContain('<script>alert(1)</script>')
        ->toContain('&lt;script&gt;alert(1)&lt;/script&gt;');
});

it('uses the post SEO fields, article type and a fallback description on a blog post', function () {
    $seo = Post::factory()->create([
        'title' => 'Bridal Makeup in Lahore',
        'slug' => 'bridal-makeup-in-lahore',
        'seo_title' => 'Bridal Makeup in Lahore: A Complete Guide',
        'seo_description' => 'Everything a bride needs to know before booking her bridal makeup artist in Lahore.',
    ]);
    $bare = Post::factory()->create([
        'title' => 'Skin Care Basics',
        'slug' => 'skin-care-basics',
        'seo_description' => null,
        'excerpt' => null,
        'body' => '<p>Hi</p>',
    ]);

    $withSeo = rawHtml($this->get('/blog/' . $seo->slug)->assertOk());
    expect($withSeo)
        // Brand suffix is dropped when it would push the title past 60 characters.
        ->toContain('<title>Bridal Makeup in Lahore: A Complete Guide</title>')
        ->toContain('content="Everything a bride needs to know before booking her bridal makeup artist in Lahore."')
        ->toContain('property="og:type" content="article"')
        ->toContain('<h1>Bridal Makeup in Lahore</h1>')
        ->toContain('<link rel="canonical" href="' . route('blog.show', $seo->slug) . '" data-inertia="canonical">');

    $fallback = rawHtml($this->get('/blog/' . $bare->slug)->assertOk());
    expect($fallback)->toMatch('/<meta name="description" content="Skin Care Basics — beauty advice from the team at [^"]*Central Park Housing Scheme, Lahore\./');
});

it('keeps search and category filtered listing pages out of the index but canonical to the base URL', function (string $url, string $base) {
    ServiceCategory::factory()->create();

    $html = rawHtml($this->get($url)->assertOk());

    expect($html)
        ->toContain('<meta name="robots" content="noindex,follow" data-inertia="robots">')
        ->toContain('<link rel="canonical" href="' . url($base) . '" data-inertia="canonical">');
})->with([
    'services search' => ['/services?search=facial', '/services'],
    'services category' => ['/services?category=1', '/services'],
    'blog search' => ['/blog?search=hair', '/blog'],
]);

it('does not mark the plain listing pages noindex', function (string $path) {
    expect(rawHtml($this->get($path)->assertOk()))->not->toContain('name="robots"');
})->with(['/services', '/blog', '/']);

it('lists deal names in the deals page fallback', function () {
    // Explicit window: the factory's random `ends_at` can land in the past, which makes the deal inactive.
    Deal::factory()->create([
        'title' => 'Bridal Glow Package',
        'category_tag' => 'Bridal',
        'is_active' => true,
        'starts_at' => now()->subDay(),
        'ends_at' => now()->addMonth(),
    ]);

    expect(rawHtml($this->get('/deals')->assertOk()))->toContain('Bridal Glow Package');
});

it('hands the browser the exact same head data under the seoMeta prop (so tags are swapped, not duplicated)', function () {
    $category = ServiceCategory::factory()->create();
    Service::factory()->create([
        'service_category_id' => $category->id,
        'slug' => 'face-polisher',
        'name' => 'Face Polisher',
        'seo_description' => null,
        'description' => null,
    ]);

    $response = $this->get('/services/face-polisher')->assertOk();
    $raw = rawHtml($response);

    $response->assertInertia(fn ($page) => $page
        ->component('Public/ServiceDetail')
        ->where('seoMeta.title', 'Face Polisher in Lahore')
        ->where('seoMeta.canonical', route('services.show', 'face-polisher'))
        ->has('seoMeta.meta')
        ->missing('seoMeta.links')
        ->missing('seoMeta.intro'));

    // And the description in the prop is the one the server wrote into the raw HTML.
    $description = $response->viewData('page')['props']['seoMeta']['meta'][0]['content'];
    expect($raw)->toContain('content="' . e($description) . '"');
});

it('leaves non-public pages (login, admin) without server-rendered SEO tags', function () {
    $html = rawHtml($this->get('/login')->assertOk());

    expect($html)->not->toContain('id="seo-fallback"')
        ->not->toContain('property="og:title"');
});

it('adds an honest lastmod to the services and blog hubs in the sitemap', function () {
    $category = ServiceCategory::factory()->create();
    Service::factory()->create(['service_category_id' => $category->id, 'slug' => 'a-service']);
    Post::factory()->create(['slug' => 'a-post']);

    $xml = simplexml_load_string($this->get('/sitemap.xml')->assertOk()->getContent());
    $lastmods = [];

    foreach ($xml->url as $node) {
        $lastmods[(string) $node->loc] = (string) ($node->lastmod ?? '');
    }

    expect($lastmods[route('services.index')])->not->toBe('')
        ->and($lastmods[route('blog.index')])->not->toBe('')
        ->and($lastmods[route('about')])->toBe('');
});

it('blocks sign-in and token screens in robots.txt', function () {
    $body = $this->get('/robots.txt')->assertOk()->getContent();

    expect($body)->toContain('Disallow: /login')
        ->toContain('Disallow: /reset-password')
        ->toContain('Disallow: /admin')
        ->toContain('Sitemap: ' . route('sitemap'));
});

/*
 * SEO Phase 2: link-preview (Open Graph / Twitter) image tags, in the raw HTML. The default branded image is
 * `public/images/og-default.jpg`; if the real one is not on disk yet a 1200x630 stand-in is created for the
 * test and removed again, so the suite never leaves files behind or depends on the artwork existing.
 */
function withDefaultShareImage(Closure $test): void
{
    $path = public_path('images/og-default.jpg');
    $created = ! is_file($path);

    if ($created) {
        $image = imagecreatetruecolor(1200, 630);
        imagejpeg($image, $path, 80);
        imagedestroy($image);
    }

    try {
        $test();
    } finally {
        if ($created) {
            @unlink($path);
        }
    }
}

function metaContent(string $html, string $key): ?string
{
    return preg_match('/<meta (?:property|name)="' . preg_quote($key, '/') . '" content="([^"]*)"/', $html, $m) ? html_entity_decode($m[1]) : null;
}

it('writes an absolute og:image with width, height and alt (plus twitter equivalents) on every public page', function (string $path) {
    withDefaultShareImage(function () use ($path) {
        $html = rawHtml($this->get($path)->assertOk());

        expect(metaContent($html, 'og:image'))->toMatch('#^https?://[^/]+/images/og-default\.jpg$#')
            ->and(metaContent($html, 'og:image:width'))->toBe('1200')
            ->and(metaContent($html, 'og:image:height'))->toBe('630')
            ->and(metaContent($html, 'og:image:alt'))->not->toBeEmpty()
            ->and(metaContent($html, 'og:locale'))->toBe('en_PK')
            ->and(metaContent($html, 'twitter:card'))->toBe('summary_large_image')
            ->and(metaContent($html, 'twitter:image'))->toBe(metaContent($html, 'og:image'))
            ->and(metaContent($html, 'twitter:title'))->not->toBeEmpty()
            ->and(metaContent($html, 'twitter:description'))->not->toBeEmpty();

        foreach (['og:image', 'og:image:width', 'og:image:height', 'og:image:alt', 'twitter:image'] as $key) {
            expect(preg_match_all('/(?:property|name)="' . preg_quote($key, '/') . '"/', $html))->toBe(1);
        }
    });
})->with('staticPublicPages');

it('uses the service own image for og:image and falls back to the branded default without one', function () {
    withDefaultShareImage(function () {
        $category = ServiceCategory::factory()->create(['stock_image_url' => 'https://example.com/category-stock.jpg']);
        Service::factory()->create(['service_category_id' => $category->id, 'slug' => 'with-photo', 'name' => 'With Photo', 'stock_image_url' => 'https://example.com/own.jpg']);
        Service::factory()->create(['service_category_id' => $category->id, 'slug' => 'no-photo', 'name' => 'No Photo', 'stock_image_url' => null]);

        $own = rawHtml($this->get('/services/with-photo')->assertOk());
        expect(metaContent($own, 'og:image'))->toBe('https://example.com/own.jpg')
            ->and(metaContent($own, 'og:image:alt'))->toBe('With Photo')
            // Size is never guessed for an external file.
            ->and($own)->not->toContain('og:image:width');

        $default = rawHtml($this->get('/services/no-photo')->assertOk());
        expect(metaContent($default, 'og:image'))->toEndWith('/images/og-default.jpg')
            ->and(metaContent($default, 'og:image:width'))->toBe('1200');
    });
});

it('turns a relative blog cover path into an absolute og:image', function () {
    Post::factory()->create(['slug' => 'with-cover', 'cover_image_path' => null, 'cover_image_url' => '/images/bride 1.jpg']);

    $html = rawHtml($this->get('/blog/with-cover')->assertOk());

    expect(metaContent($html, 'og:image'))->toMatch('#^https?://[^/]+/images/bride%201\.jpg$#')
        ->and(metaContent($html, 'og:image:alt'))->not->toBeEmpty();
});

/*
 * SEO Phase 4: keyword-aware titles, descriptions and H1s, built at render time (database rows are never
 * touched), with admin-written SEO fields always winning.
 */

function pageTitle(string $html): string
{
    preg_match('/<title>([^<]*)<\/title>/', $html, $m);

    return html_entity_decode($m[1] ?? '');
}

it('gives every public page a unique title and meta description of a sensible length', function () {
    $titles = [];
    $descriptions = [];

    foreach (['/', '/services', '/deals', '/gallery', '/blog', '/about', '/contact', '/book'] as $path) {
        $html = rawHtml($this->get($path)->assertOk());
        $title = pageTitle($html);
        $description = metaContent($html, 'description');

        expect(mb_strlen($title))->toBeGreaterThanOrEqual(25)->toBeLessThanOrEqual(60, "{$path} title is too long: {$title}")
            ->and(mb_strlen($description))->toBeGreaterThanOrEqual(120)->toBeLessThanOrEqual(160, "{$path} description length")
            ->and(metaContent($html, 'og:title'))->toBe($title);

        $titles[] = $title;
        $descriptions[] = $description;
    }

    expect(array_unique($titles))->toHaveCount(count($titles))
        ->and(array_unique($descriptions))->toHaveCount(count($descriptions));
});

it('puts the hyper-local keywords on the right pages without stuffing', function () {
    $home = rawHtml($this->get('/')->assertOk());

    expect(pageTitle($home))->toBe('Looks Smart Beauty Salon | Central Park, Lahore')
        ->and($home)->toContain('<h1>Beauty Salon in Central Park Housing Scheme, Lahore</h1>')
        ->and(metaContent($home, 'description'))->toContain('46-B Commercial Central Park Housing Scheme, Main Ferozpur Road, Lahore')
        // Roman Urdu terms live only in descriptions, never in a title.
        ->and(pageTitle($home))->not->toMatch('/parlour|dulhan/i');

    foreach (['/', '/about', '/services'] as $path) {
        expect(metaContent(rawHtml($this->get($path)->assertOk()), 'description'))->toMatch('/parlour|dulhan/i');
    }

    foreach (['/contact', '/gallery', '/deals', '/book', '/blog'] as $path) {
        expect(metaContent(rawHtml($this->get($path)->assertOk()), 'description'))->not->toMatch('/parlour|dulhan/i');
    }
});

it('does not name any nearby area or city that the owner has not confirmed', function () {
    foreach (['/', '/services', '/about', '/contact'] as $path) {
        expect(rawHtml($this->get($path)->assertOk()))->not->toMatch('/Kahna|Kasur|Okara|Sheikhupura/i');
    }
});

it('writes "{name} in Lahore" as the fallback title and H1 of a service, within 60 characters when it fits the brand', function () {
    $category = ServiceCategory::factory()->create();
    Service::factory()->create(['service_category_id' => $category->id, 'slug' => 'hair-botox', 'name' => 'Hair Botox Treatment', 'seo_title' => null]);
    Service::factory()->create(['service_category_id' => $category->id, 'slug' => 'barat-makeup', 'name' => 'Barat / Walima Bridal Makeup', 'seo_title' => null]);
    Service::factory()->create(['service_category_id' => $category->id, 'slug' => 'lahore-facial', 'name' => 'Lahore Glow Facial', 'seo_title' => null]);

    $short = rawHtml($this->get('/services/hair-botox')->assertOk());
    expect(pageTitle($short))->toBe('Hair Botox Treatment in Lahore | Looks Smart Beauty Salon')
        ->and($short)->toContain('<h1>Hair Botox Treatment in Lahore</h1>');

    // Too long to carry the brand: the keyword title stays whole instead.
    expect(pageTitle(rawHtml($this->get('/services/barat-makeup')->assertOk())))->toBe('Barat / Walima Bridal Makeup in Lahore');

    // "Lahore" is not repeated when the name already says it.
    expect(rawHtml($this->get('/services/lahore-facial')->assertOk()))->toContain('<h1>Lahore Glow Facial</h1>');
});

it('lets an admin-written service SEO title and description win over the generated ones', function () {
    $category = ServiceCategory::factory()->create();
    Service::factory()->create([
        'service_category_id' => $category->id,
        'slug' => 'admin-written',
        'name' => 'Some Service',
        'seo_title' => 'Custom Admin Title',
        'seo_description' => 'This description was written by the admin in the panel and must be used exactly as written.',
    ]);

    $html = rawHtml($this->get('/services/admin-written')->assertOk());

    expect(pageTitle($html))->toBe('Custom Admin Title | Looks Smart Beauty Salon')
        ->and(metaContent($html, 'description'))->toBe('This description was written by the admin in the panel and must be used exactly as written.');
});

it('lets the admin default title and description (Settings > SEO) win on the homepage', function () {
    Setting::create(['key' => 'seo.default_title', 'value' => 'Admin Home Title', 'group' => 'seo', 'is_encrypted' => false]);
    Setting::create(['key' => 'seo.default_description', 'value' => 'An admin-written homepage description that is long enough to be a real meta description.', 'group' => 'seo', 'is_encrypted' => false]);

    $html = rawHtml($this->get('/')->assertOk());

    expect(pageTitle($html))->toBe('Admin Home Title | Looks Smart Beauty Salon')
        ->and(metaContent($html, 'description'))->toStartWith('An admin-written homepage description');
});

it('hands the browser the exact final title so the client never re-titles the page', function () {
    $category = ServiceCategory::factory()->create();
    Service::factory()->create(['service_category_id' => $category->id, 'slug' => 'face-polisher', 'name' => 'Face Polisher', 'seo_title' => null]);

    $response = $this->get('/services/face-polisher')->assertOk();
    $response->assertInertia(fn ($page) => $page->where('seoMeta.fullTitle', 'Face Polisher in Lahore | Looks Smart Beauty Salon'));
    expect(pageTitle(rawHtml($response)))->toBe('Face Polisher in Lahore | Looks Smart Beauty Salon');
});

it('gives the homepage a Find us block with directions and a Maps link in the page payload and raw fallback', function () {
    $response = $this->get('/')->assertOk();
    $raw = rawHtml($response);

    $response->assertInertia(fn ($page) => $page
        ->where('findUs.directions', fn ($value) => str_contains($value, 'near UBL Bank') && str_contains($value, 'Gate No. 1') && str_contains($value, 'B Block, Main Boulevard'))
        ->where('findUs.mapsUrl', 'https://www.google.com/maps/dir/?api=1&destination=31.317056,74.389306'));

    expect($raw)->toContain('near UBL Bank')->toContain('Gate No. 1')->toContain('46-B, Commercial Central Park Housing Scheme, Main Ferozpur Road, Lahore');
});

/*
 * Hero poster / boot screen / favicons: the crawlable copy stays in the raw HTML but is visually hidden
 * with the sr-only pattern (never display:none), visitors see a branded boot screen instead, and the
 * head carries the full icon set.
 */

it('keeps the crawlable H1 in the raw HTML but visually hidden with sr-only, never display:none', function () {
    $html = rawHtml($this->get('/')->assertOk());

    expect($html)->toContain('<main id="seo-fallback">')
        ->toContain('<h1>Beauty Salon in Central Park Housing Scheme, Lahore</h1>');

    preg_match('/#seo-fallback\{([^}]*)\}/', $html, $rule);

    expect($rule[1] ?? '')->toContain('position:absolute')->toContain('width:1px')->toContain('clip:rect(0,0,0,0)')
        ->not->toContain('display:none')->not->toContain('visibility:hidden');
});

it('shows a branded boot screen with a CSS failsafe, styled with the CSP nonce', function () {
    $html = rawHtml($this->get('/')->assertOk());

    expect($html)->toContain('id="boot-screen"')
        ->toContain('src="/favicon.svg"')
        ->toContain('background:#2a2420')
        ->toContain('animation:boot-failsafe')
        ->toMatch('/<style nonce="[^"]+">\s*#boot-screen/');
});

it('declares the full favicon set and preloads the right hero poster on the homepage', function () {
    $html = rawHtml($this->get('/')->assertOk());

    expect($html)->toContain('<link rel="icon" type="image/svg+xml" href="/favicon.svg">')
        ->toContain('<link rel="icon" href="/favicon.ico" sizes="48x48">')
        ->toContain('<link rel="icon" type="image/png" sizes="48x48" href="/favicon-48x48.png">')
        ->toContain('<link rel="icon" type="image/png" sizes="192x192" href="/favicon-192x192.png">')
        ->toContain('<link rel="apple-touch-icon" href="/apple-touch-icon.png">')
        ->toContain('href="/images/hero-poster.webp" media="(min-width: 768px)" fetchpriority="high"')
        ->toContain('href="/images/hero-poster-mobile.webp" media="(max-width: 767px)" fetchpriority="high"');

    // Only the homepage preloads the hero.
    expect(rawHtml($this->get('/about')->assertOk()))->not->toContain('hero-poster');
});

it('ships every icon and hero image as a real file, and robots.txt does not block them', function () {
    foreach (['favicon.ico', 'favicon.svg', 'favicon-48x48.png', 'favicon-192x192.png', 'apple-touch-icon.png', 'icon-512x512.png',
        'images/hero-poster.jpg', 'images/hero-poster.webp', 'images/hero-poster-mobile.jpg', 'images/hero-poster-mobile.webp'] as $file) {
        expect(filesize(public_path($file)))->toBeGreaterThan(1000, $file);
    }

    $robots = $this->get('/robots.txt')->assertOk()->getContent();

    expect($robots)->not->toMatch('#Disallow:\s*/(favicon|apple-touch|icon-|images)#');
});

it('lists the 192 and 512 PNG icons in the web manifest', function () {
    $icons = $this->get('/manifest.json')->assertOk()->json('icons');
    $sources = array_column($icons, 'src');

    expect(collect($sources)->contains(fn ($src) => str_ends_with($src, '/favicon-192x192.png')))->toBeTrue()
        ->and(collect($sources)->contains(fn ($src) => str_ends_with($src, '/icon-512x512.png')))->toBeTrue();
});

it('adds the hero photo to the BeautySalon image list without a second block', function () {
    $html = rawHtml($this->get('/')->assertOk());
    $salons = array_values(array_filter(ldBlocks($html), fn ($b) => ($b['@type'] ?? null) === 'BeautySalon'));

    expect($salons)->toHaveCount(1)
        ->and((array) $salons[0]['image'])->toContain(url('images/hero-poster.jpg'));
    expect(metaContent($html, 'og:image'))->toEndWith('/images/og-default.jpg');
});
