<?php

use App\Models\BusinessHour;
use App\Models\Post;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Setting;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/*
 * SEO Phase 3: JSON-LD structured data. Everything is read from the RAW server response (never the Inertia
 * page object, never JavaScript), because Google's first pass and rich-result tools may not run JS. Each
 * schema type must appear exactly once per page.
 */

/** @return list<array<string, mixed>> every decoded <script type="application/ld+json"> block in the HTML */
function ldBlocks(string $html): array
{
    preg_match_all('#<script type="application/ld\+json"[^>]*>(.*?)</script>#s', $html, $matches);

    return array_map(function (string $json) {
        $decoded = json_decode($json, true, 512, JSON_THROW_ON_ERROR); // invalid JSON fails the test

        return $decoded;
    }, $matches[1]);
}

/** @return array<string, mixed>|null */
function ldOfType(string $html, string $type): ?array
{
    $found = array_values(array_filter(ldBlocks($html), fn ($block) => ($block['@type'] ?? null) === $type));

    expect(count($found))->toBeLessThanOrEqual(1, "{$type} appears more than once");

    return $found[0] ?? null;
}

it('puts one BeautySalon block with address, geo, hours, area and socials in the homepage raw HTML', function () {
    foreach ([1, 2, 3, 4, 5, 6, 0] as $weekday) {
        BusinessHour::create(['weekday' => $weekday, 'open_time' => '10:00:00', 'close_time' => '21:00:00', 'is_closed' => false]);
    }
    Setting::create(['key' => 'business.social_instagram', 'value' => 'https://www.instagram.com/lookssmart', 'group' => 'business', 'is_encrypted' => false]);
    Setting::create(['key' => 'business.social_facebook', 'value' => 'not-a-url', 'group' => 'business', 'is_encrypted' => false]);

    $html = $this->get('/')->assertOk()->getContent();
    $salon = ldOfType($html, 'BeautySalon');

    expect($salon)->not->toBeNull()
        ->and($salon['@context'])->toBe('https://schema.org')
        ->and($salon['name'])->not->toBeEmpty()
        ->and($salon['url'])->toBe(route('home'))
        ->and($salon['telephone'])->toBe('+92 305 9833859')
        ->and($salon['address'])->toMatchArray([
            '@type' => 'PostalAddress',
            'addressLocality' => 'Lahore',
            'addressRegion' => 'Punjab',
            'addressCountry' => 'PK',
        ])
        ->and($salon['address']['streetAddress'])->toContain('Central Park Housing Scheme')
        ->and($salon['geo'])->toMatchArray(['@type' => 'GeoCoordinates', 'latitude' => 31.317056, 'longitude' => 74.389306])
        ->and($salon['areaServed']['name'])->toBe('Central Park Housing Scheme, Lahore')
        // Seven identical days collapse into ONE specification, hours straight from the table.
        ->and($salon['openingHoursSpecification'])->toHaveCount(1)
        ->and($salon['openingHoursSpecification'][0]['opens'])->toBe('10:00')
        ->and($salon['openingHoursSpecification'][0]['closes'])->toBe('21:00')
        ->and($salon['openingHoursSpecification'][0]['dayOfWeek'])->toHaveCount(7)
        // Only real URLs make it into sameAs.
        ->and($salon['sameAs'])->toBe(['https://www.instagram.com/lookssmart'])
        // Nothing invented: no price range, no reviews, no ratings.
        ->and($salon)->not->toHaveKeys(['priceRange', 'review', 'aggregateRating']);

    // Homepage only carries the salon block — no Service/Article/Breadcrumb there.
    expect(ldBlocks($html))->toHaveCount(1);
});

it('lets Settings override the phone number and coordinates', function () {
    Setting::create(['key' => 'business.phone', 'value' => '+92 300 1112223', 'group' => 'business', 'is_encrypted' => false]);
    Setting::create(['key' => 'business.latitude', 'value' => 31.5, 'group' => 'business', 'is_encrypted' => false]);
    Setting::create(['key' => 'business.longitude', 'value' => 74.3, 'group' => 'business', 'is_encrypted' => false]);

    $salon = ldOfType($this->get('/')->getContent(), 'BeautySalon');

    expect($salon['telephone'])->toBe('+92 300 1112223')
        ->and($salon['geo']['latitude'])->toBe(31.5)
        ->and($salon['geo']['longitude'])->toBe(74.3);
});

it('writes Service and BreadcrumbList schema on a service page, with the database price in offers', function () {
    $category = ServiceCategory::factory()->create(['name' => 'Hair']);
    $service = Service::factory()->create([
        'service_category_id' => $category->id,
        'slug' => 'blowout',
        'name' => 'Signature Blowout',
        'base_price' => 65,
        'duration_min' => 45,
        'is_active' => true,
    ]);

    $html = $this->get('/services/blowout')->assertOk()->getContent();
    $schema = ldOfType($html, 'Service');
    $crumbs = ldOfType($html, 'BreadcrumbList');

    expect($schema['name'])->toBe('Signature Blowout')
        ->and($schema['serviceType'])->toBe('Hair')
        ->and($schema['provider'])->toMatchArray(['@id' => route('home') . '#salon'])
        ->and($schema['areaServed']['name'])->toBe('Central Park Housing Scheme, Lahore')
        ->and($schema['offers']['price'])->toBe('65.00')
        ->and($schema['offers']['priceCurrency'])->toBe('PKR')
        ->and($schema['additionalProperty']['value'])->toBe('45 minutes')
        ->and(array_column($crumbs['itemListElement'], 'name'))->toBe(['Home', 'Services', 'Signature Blowout'])
        ->and(array_column($crumbs['itemListElement'], 'position'))->toBe([1, 2, 3])
        ->and($crumbs['itemListElement'][2]['item'])->toBe(route('services.show', $service->slug));

    expect(ldBlocks($html))->toHaveCount(2);
});

it('leaves offers out when the service has no price in the database', function () {
    $category = ServiceCategory::factory()->create();
    Service::factory()->create(['service_category_id' => $category->id, 'slug' => 'consult', 'base_price' => 0, 'is_active' => true]);

    $schema = ldOfType($this->get('/services/consult')->assertOk()->getContent(), 'Service');

    expect($schema)->not->toBeNull()->and($schema)->not->toHaveKey('offers');
});

it('writes BlogPosting and BreadcrumbList schema on a blog post with the salon as author and publisher', function () {
    $post = Post::factory()->create([
        'slug' => 'seasonal-hair-care',
        'title' => 'Seasonal Hair Care Tips',
        'status' => 'published',
    ]);

    $html = $this->get('/blog/seasonal-hair-care')->assertOk()->getContent();
    $article = ldOfType($html, 'BlogPosting');
    $crumbs = ldOfType($html, 'BreadcrumbList');

    expect($article['headline'])->toBe('Seasonal Hair Care Tips')
        ->and($article['datePublished'])->toBe($post->published_at->toIso8601String())
        ->and($article['dateModified'])->toBe($post->updated_at->toIso8601String())
        ->and($article['author']['@id'])->toBe(route('home') . '#salon')
        ->and($article['publisher']['@type'])->toBe('Organization')
        ->and($article['mainEntityOfPage']['@id'])->toBe(route('blog.show', 'seasonal-hair-care'))
        ->and(array_column($crumbs['itemListElement'], 'name'))->toBe(['Home', 'Blog', 'Seasonal Hair Care Tips']);

    // The image is always an absolute URL (own cover, else the branded default when it exists).
    if (isset($article['image'])) {
        expect($article['image'])->toMatch('#^https?://#');
    }

    expect(ldBlocks($html))->toHaveCount(2);
});

it('cannot be broken out of by hostile text in a title', function () {
    $category = ServiceCategory::factory()->create();
    Service::factory()->create([
        'service_category_id' => $category->id,
        'slug' => 'tricky',
        'name' => 'Glow </script><script>alert(1)</script>',
        'is_active' => true,
    ]);

    $html = $this->get('/services/tricky')->assertOk()->getContent();

    expect($html)->not->toContain('</script><script>alert(1)')
        ->and(ldOfType($html, 'Service')['name'])->toBe('Glow </script><script>alert(1)</script>');
});

it('adds no JSON-LD to pages that are not meant to have it', function (string $path) {
    expect(ldBlocks($this->get($path)->assertOk()->getContent()))->toBe([]);
})->with(['/services', '/blog', '/about', '/contact', '/deals']);

it('never emits Review or AggregateRating schema anywhere', function (string $path) {
    $html = $this->get($path)->getContent();

    expect($html)->not->toContain('AggregateRating')->not->toContain('"@type":"Review"');
})->with(['/', '/services', '/about']);
