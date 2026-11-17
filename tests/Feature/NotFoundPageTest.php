<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('serves the branded 404 page with a real 404 status for an unknown public URL', function () {
    $response = $this->get('/abcd')->assertNotFound();

    $response->assertInertia(fn ($page) => $page->component('Errors/NotFound'));

    $html = $response->getContent();
    expect($html)->toContain('<meta name="robots" content="noindex,follow"')
        ->and($html)->toContain('<title>Page not found | Looks Smart Beauty Salon</title>')
        ->and($html)->not->toContain('rel="canonical"')
        ->and($html)->not->toContain('application/ld+json')
        ->and($html)->toContain('<h1>Page not found</h1>')
        ->and($html)->toContain('Let&#039;s get you back to something beautiful.');

    foreach (['/services', '/deals', '/gallery', '/faqs', '/contact'] as $path) {
        expect($html)->toContain('href="' . url($path) . '"');
    }
});

it('uses the same 404 page for unknown blog and deal slugs', function () {
    $this->get('/blog/nothing-here')->assertNotFound()->assertInertia(fn ($page) => $page->component('Errors/NotFound'));
    $this->get('/deals/nothing-here')->assertNotFound()->assertInertia(fn ($page) => $page->component('Errors/NotFound'));
});

it('keeps a JSON 404 for JSON requests and leaves admin paths alone', function () {
    $this->getJson('/abcd')->assertNotFound()->assertJsonMissingPath('component');

    $admin = $this->get('/admin/abcd')->assertNotFound();
    expect($admin->getContent())->not->toContain('Errors/NotFound');
});

it('does not list the 404 page in the sitemap', function () {
    expect($this->get('/sitemap.xml')->getContent())->not->toContain('abcd');
});

it('ships the 404 page with the agreed content, theme tokens and no inline styles', function () {
    $source = file_get_contents(resource_path('js/Pages/Errors/NotFound.tsx'));

    expect($source)->toContain('404')
        ->toContain('Page not found')
        ->toContain('Back to home')
        ->toContain('View services')
        ->toContain('Book appointment')
        ->toContain('prefers-reduced-motion')
        ->toContain("import('matter-js')")
        ->not->toContain('style={{')
        ->not->toContain('<style')
        ->not->toMatch('/#[0-9a-fA-F]{6}\b/');

    foreach (['Hair', 'Skin', 'Bridal', 'Makeup', 'Waxing', 'Spa'] as $label) {
        expect($source)->toContain("label: '{$label}'");
    }
});


it('loads matter-js only through a dynamic import on the 404 page', function () {
    $root = resource_path('js');
    $static = [];
    $dynamic = [];

    foreach (new RecursiveIteratorIterator(new RecursiveDirectoryIterator($root)) as $file) {
        if (! preg_match('/\.(tsx?|jsx?)$/', $file->getFilename())) {
            continue;
        }
        $code = file_get_contents($file->getPathname());
        $rel = str_replace(DIRECTORY_SEPARATOR, '/', substr($file->getPathname(), strlen($root) + 1));

        // A runtime (non-type) static import of matter-js.
        if (preg_match('/^\s*import\s+(?!type\b)[^;]*from\s+[\'"]matter-js[\'"]/m', $code)) {
            $static[] = $rel;
        }
        if (str_contains($code, "import('matter-js')")) {
            $dynamic[] = $rel;
        }
    }

    expect($static)->toBe([])->and($dynamic)->toBe(['Pages/Errors/NotFound.tsx']);
    expect(file_get_contents(resource_path('js/lib/cardPhysics.ts')))->toContain("import type MatterNS from 'matter-js'")
        ->not->toContain('style={{')
        ->not->toMatch('/setAttribute\(\s*[\'"]style/');
});

it('serves the crawlable H1 as Page not found, matching the visible heading', function () {
    $html = $this->get('/abcd')->assertNotFound()->getContent();

    expect($html)->toContain('<h1>Page not found</h1>');
});
