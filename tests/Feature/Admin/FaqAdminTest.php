<?php

use App\Models\Faq;
use App\Models\FaqCategory;
use App\Models\User;
use App\Support\FaqData;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function faqAdmin(): User
{
    test()->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'two_factor_secret' => encrypt('s'),
        'two_factor_confirmed_at' => now(),
    ]);
    $user->assignRole('admin');

    return $user;
}

function faqSchemaQuestions(string $html): array
{
    preg_match_all('#<script type="application/ld\+json"[^>]*>(.*?)</script>#s', $html, $m);

    foreach ($m[1] as $json) {
        $block = json_decode($json, true);
        if (($block['@type'] ?? null) === 'FAQPage') {
            return array_column($block['mainEntity'], 'name');
        }
    }

    return [];
}

it('loads the defaults once, then shows an added question publicly and drops it when deactivated', function () {
    $admin = faqAdmin();

    $this->actingAs($admin)->post('/admin/faqs/load-defaults')->assertSessionHasNoErrors();
    expect(Faq::count())->toBe(22)->and(FaqCategory::count())->toBe(5);

    // Idempotent: a second run is refused and never duplicates.
    $this->actingAs($admin)->post('/admin/faqs/load-defaults');
    expect(Faq::count())->toBe(22);

    $this->actingAs($admin)->post('/admin/faqs', [
        'faq_category_id' => FaqCategory::first()->id,
        'question' => 'Do you sell gift cards?',
        'answer' => 'Ask us on WhatsApp at {phone}.',
        'links' => [['label' => 'Contact us', 'href' => '/contact']],
        'is_active' => true,
        'show_in_preview' => false,
    ])->assertSessionHasNoErrors();

    $html = $this->get('/faqs')->getContent();
    expect(faqSchemaQuestions($html))->toContain('Do you sell gift cards?')
        ->and($html)->toContain('Ask us on WhatsApp at +92 305 9833859.');

    $faq = Faq::where('question', 'Do you sell gift cards?')->first();
    $this->actingAs($admin)->patch("/admin/faqs/{$faq->id}/toggle");
    FaqData::flush();

    expect(faqSchemaQuestions($this->get('/faqs')->getContent()))->not->toContain('Do you sell gift cards?');
});

it('rejects unsafe link addresses and blocks deleting a category that has questions', function () {
    $admin = faqAdmin();
    $category = FaqCategory::create(['name' => 'Misc', 'slug' => 'misc', 'sort_order' => 1, 'is_active' => true]);

    $this->actingAs($admin)->post('/admin/faqs', [
        'faq_category_id' => $category->id, 'question' => 'Q?', 'answer' => 'A.',
        'links' => [['label' => 'Bad', 'href' => 'javascript:alert(1)']],
    ])->assertSessionHasErrors('links.0.href');

    Faq::create(['faq_category_id' => $category->id, 'question' => 'Q?', 'answer' => 'A.', 'sort_order' => 1, 'is_active' => true, 'show_in_preview' => false]);
    $this->actingAs($admin)->delete("/admin/faq-categories/{$category->id}")->assertSessionHas('error');
    expect(FaqCategory::count())->toBe(1);
});

it('falls back to the built-in FAQs while the tables are empty', function () {
    expect(faqSchemaQuestions($this->get('/faqs')->getContent()))->toHaveCount(22);
});
