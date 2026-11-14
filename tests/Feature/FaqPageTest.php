<?php

use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function faqJsonLdBlocks(string $html): array
{
    preg_match_all('#<script type="application/ld\+json"[^>]*>(.*?)</script>#s', $html, $matches);

    return array_map(fn (string $json) => json_decode($json, true), $matches[1]);
}

it('serves /faqs with the title, one h1, canonical, answers in raw html and one FAQPage block', function () {
    $html = $this->get('/faqs')->assertOk()->getContent();

    expect($html)->toContain('<title>FAQs: Booking, Prices and Visiting | Looks Smart Lahore</title>')
        ->and(substr_count($html, '<h1'))->toBe(1)
        ->and($html)->toContain('<link rel="canonical" href="'.route('faqs.index').'"')
        ->and($html)->toContain('You can pay by cash, bank transfer, JazzCash or Easypaisa.')
        ->and($html)->toContain('+92 305 9833859')
        ->and($html)->toContain('Monday to Sunday, 10:00 AM to 9:00 PM')
        ->and($html)->not->toContain('{phone}')
        ->and($html)->not->toContain('{address}')
        ->and($html)->not->toContain('{hours}');

    $faqPages = array_values(array_filter(faqJsonLdBlocks($html), fn ($block) => ($block['@type'] ?? null) === 'FAQPage'));

    expect($faqPages)->toHaveCount(1)
        ->and($faqPages[0]['mainEntity'])->toHaveCount(22);
});

it('lists /faqs in the sitemap', function () {
    expect($this->get('/sitemap.xml')->getContent())->toContain(route('faqs.index'));
});

it('does not emit FAQPage schema on Home or Contact', function () {
    foreach (['/', '/contact'] as $path) {
        $types = array_map(fn ($block) => $block['@type'] ?? null, faqJsonLdBlocks($this->get($path)->getContent()));

        expect($types)->not->toContain('FAQPage');
    }
});

it('passes only the five preview questions to Home and Contact', function () {
    foreach (['/', '/contact'] as $path) {
        $this->get($path)->assertInertia(fn ($page) => $page->has('faqPreview', 5));
    }
});
