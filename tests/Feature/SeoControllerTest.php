<?php

use App\Models\Post;
use App\Models\Service;
use App\Models\ServiceCategory;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('generates a valid sitemap.xml including active services and published posts', function () {
    $category = ServiceCategory::factory()->create();
    $activeService = Service::factory()->create([
        'service_category_id' => $category->id,
        'slug' => 'signature-facial',
        'is_active' => true,
    ]);
    Service::factory()->create([
        'service_category_id' => $category->id,
        'slug' => 'retired-service',
        'is_active' => false,
    ]);

    $publishedPost = Post::factory()->create(['slug' => 'a-real-post', 'status' => 'published']);
    Post::factory()->create(['slug' => 'a-draft-post', 'status' => 'draft']);

    $response = $this->get('/sitemap.xml');

    $response->assertOk();
    $response->assertHeader('Content-Type', 'text/xml; charset=UTF-8');

    $xml = simplexml_load_string($response->getContent());
    expect($xml)->not->toBeFalse();
    expect($xml->getName())->toBe('urlset');

    // A plain foreach is required here, not collect($xml->url) — SimpleXML's foreach magic walks
    // every sibling <url> node, but collect() on the same property only sees the last one.
    $locs = [];
    foreach ($xml->url as $urlNode) {
        $locs[] = (string) $urlNode->loc;
    }

    expect($locs)->toContain(url('/'))
        ->toContain(route('services.show', $activeService->slug))
        ->toContain(route('blog.show', $publishedPost->slug))
        ->not->toContain(route('services.show', 'retired-service'))
        ->not->toContain(route('blog.show', 'a-draft-post'));

    // /deals is now a real, controller-backed page (Deals & Offers task) and belongs in the sitemap.
    expect($locs)->toContain(route('deals.index'));
});

it('generates a robots.txt disallowing admin/private areas and pointing at the sitemap', function () {
    $response = $this->get('/robots.txt');

    $response->assertOk();
    $response->assertHeader('Content-Type', 'text/plain; charset=UTF-8');

    $body = $response->getContent();
    expect($body)->toContain('User-agent: *')
        ->toContain('Disallow: /admin')
        ->toContain('Disallow: /my-account')
        ->toContain('Sitemap: ' . route('sitemap'));
});
