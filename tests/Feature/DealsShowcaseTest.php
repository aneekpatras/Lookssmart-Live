<?php

use App\Models\Deal;
use App\Models\Setting;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function setDealsBar(array $values): void
{
    foreach ($values as $key => $value) {
        Setting::create(['key' => "deals_bar.{$key}", 'value' => $value, 'group' => 'deals_bar', 'is_encrypted' => false]);
    }
}

it('shows the deals bar by default while deals are live, with a fallback headline and a Claim link', function () {
    $deal = Deal::factory()->create(['is_active' => true, 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()]);

    $this->get('/')->assertInertia(fn ($page) => $page
        ->where('dealsBar.headline', 'Current salon deals and bridal packages')
        ->where('dealsBar.ends_at', null)
        ->where('dealsBar.claim_label', 'Claim offer')
        ->where('dealsBar.claim_url', fn ($url) => str_starts_with($url, '/book')));
    expect($deal->exists)->toBeTrue();
});

it('hides the deals bar when switched off, or when there is neither text nor a live deal', function () {
    $this->get('/')->assertInertia(fn ($page) => $page->where('dealsBar', null));

    Deal::factory()->create(['is_active' => true, 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()]);
    setDealsBar(['enabled' => false, 'headline' => 'Hidden on purpose']);
    $this->get('/')->assertInertia(fn ($page) => $page->where('dealsBar', null));
});

it('points Claim at the deal the admin picked', function () {
    $picked = Deal::factory()->create(['is_active' => true, 'code' => 'PICKME', 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()]);
    Deal::factory()->create(['is_active' => true, 'is_top_deal' => true, 'code' => 'OTHERONE', 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()]);
    setDealsBar(['enabled' => true, 'headline' => 'Pick', 'deal_id' => $picked->id, 'claim_label' => 'Grab it']);

    $this->get('/')->assertInertia(fn ($page) => $page
        ->where('dealsBar.claim_label', 'Grab it')
        ->where('dealsBar.claim_url', fn ($url) => str_contains($url, 'code=PICKME')));
});

it('passes the admin-written deals bar to the homepage, with the countdown end in the salon time zone', function () {
    setDealsBar([
        'enabled' => true,
        'headline' => 'Bridal packages this month',
        'subtext' => 'Book early for wedding dates.',
        'ends_at' => now('Asia/Karachi')->addDays(3)->format('Y-m-d\TH:i'),
    ]);

    $this->get('/')->assertInertia(fn ($page) => $page
        ->where('dealsBar.headline', 'Bridal packages this month')
        ->where('dealsBar.badge', 'Limited-time offer')
        ->where('dealsBar.button_label', 'View all deals')
        ->where('dealsBar.ends_at', fn ($end) => str_contains($end, '+05:00') && strtotime($end) > time()));
});

it('hides the deals bar once its end time has passed', function () {
    setDealsBar(['enabled' => true, 'headline' => 'Gone', 'ends_at' => now('Asia/Karachi')->subDay()->format('Y-m-d\TH:i')]);

    $this->get('/')->assertInertia(fn ($page) => $page->where('dealsBar', null));
});

it('gives every active deal its own page, with its own title in the raw HTML', function () {
    $deal = Deal::factory()->create(['title' => 'Glow Package', 'slug' => 'glow-package', 'is_active' => true, 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()]);

    $response = $this->get('/deals/glow-package')->assertOk();
    $response->assertInertia(fn ($page) => $page->component('Public/DealDetail')->where('deal.slug', 'glow-package'));

    expect($response->getContent())->toContain('<title>Glow Package')->toContain('<h1>Glow Package</h1>');
    expect($deal->slug)->toBe('glow-package');
});

it('returns 404 for an unknown or expired deal page', function () {
    Deal::factory()->create(['slug' => 'old-deal', 'is_active' => true, 'starts_at' => now()->subMonth(), 'ends_at' => now()->subDay()]);

    $this->get('/deals/old-deal')->assertNotFound();
    $this->get('/deals/nope')->assertNotFound();
});

it('lets a super-admin save the deals bar settings and rejects a bad end date', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create(['email_verified_at' => now(), 'two_factor_secret' => encrypt('s'), 'two_factor_confirmed_at' => now()]);
    $admin->assignRole('super-admin');

    $this->actingAs($admin)->put('/admin/settings/deals_bar', ['settings' => [
        'deals_bar.enabled' => 'true',
        'deals_bar.headline' => 'Eid offers',
        'deals_bar.ends_at' => '2030-01-01T20:00',
    ]])->assertRedirect();

    expect(Setting::get('deals_bar.headline'))->toBe('Eid offers')
        ->and(Setting::get('deals_bar.enabled'))->toBeTrue();

    $this->actingAs($admin)->put('/admin/settings/deals_bar', ['settings' => ['deals_bar.ends_at' => 'not a date']])
        ->assertSessionHasErrors('settings.deals_bar.ends_at');
});
