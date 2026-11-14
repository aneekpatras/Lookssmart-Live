<?php

use App\Models\Deal;
use App\Models\Gallery;
use App\Models\GalleryImage;
use App\Models\Service;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

it('exposes an active linked service on the public gallery and drops an inactive one', function () {
    $gallery = Gallery::factory()->create(['is_active' => true]);
    $active = Service::factory()->create(['is_active' => true]);
    $inactive = Service::factory()->create(['is_active' => false]);
    $a = GalleryImage::factory()->create(['gallery_id' => $gallery->id, 'linked_type' => 'service', 'linked_id' => $active->id]);
    $b = GalleryImage::factory()->create(['gallery_id' => $gallery->id, 'linked_type' => 'service', 'linked_id' => $inactive->id]);

    $images = collect($this->get('/gallery')->viewData('page')['props']['sections'])->flatMap(fn ($s) => $s['images'])->keyBy('id');

    expect($images[$a->id]['link']['name'])->toBe($active->name)
        ->and($images[$a->id]['link']['type'])->toBe('service')
        ->and($images[$b->id]['link'])->toBeNull();
});

it('validates and clears the gallery image link in admin', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create([
        'email_verified_at' => now(),
        'two_factor_secret' => encrypt('s'),
        'two_factor_confirmed_at' => now(),
    ]);
    $admin->assignRole('admin');
    $gallery = Gallery::factory()->create();
    $image = GalleryImage::factory()->create(['gallery_id' => $gallery->id]);
    $service = Service::factory()->create();
    $url = "/admin/gallery/{$gallery->id}/images/{$image->id}";

    $this->actingAs($admin)->put($url, ['linked_type' => 'bogus', 'linked_id' => 1])->assertSessionHasErrors('linked_type');
    $this->actingAs($admin)->put($url, ['linked_type' => 'service', 'linked_id' => 999999])->assertSessionHasErrors('linked_id');
    $this->actingAs($admin)->put($url, ['linked_type' => 'service', 'linked_id' => $service->id])->assertSessionHasNoErrors();
    expect($image->fresh()->linked_id)->toBe($service->id);

    $this->actingAs($admin)->put($url, ['linked_type' => null, 'linked_id' => null]);
    expect($image->fresh()->linked_type)->toBeNull();
});

it('shows the linked service name on the public gallery right after an admin save', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create([
        'email_verified_at' => now(),
        'two_factor_secret' => encrypt('s'),
        'two_factor_confirmed_at' => now(),
    ]);
    $admin->assignRole('admin');
    $gallery = Gallery::factory()->create(['is_active' => true]);
    $image = GalleryImage::factory()->create(['gallery_id' => $gallery->id, 'caption' => 'Old caption']);
    $service = Service::factory()->create(['is_active' => true]);

    $this->actingAs($admin)->put("/admin/gallery/{$gallery->id}/images/{$image->id}", [
        'linked_type' => 'service', 'linked_id' => $service->id,
    ])->assertSessionHasNoErrors();

    $edit = $this->actingAs($admin)->get("/admin/gallery/{$gallery->id}/edit")->viewData('page')['props']['gallery']['images'][0];
    expect($edit['linked_type'])->toBe('service')->and($edit['linked_id'])->toBe($service->id);

    $images = collect($this->get('/gallery')->viewData('page')['props']['sections'])->flatMap(fn ($sec) => $sec['images'])->keyBy('id');
    expect($images[$image->id]['link']['name'])->toBe($service->name);
});

it('returns price, duration and deal pricing fields for linked items', function () {
    $gallery = Gallery::factory()->create(['is_active' => true]);
    $service = Service::factory()->create(['is_active' => true, 'base_price' => 10500, 'duration_min' => 90]);
    $deal = Deal::factory()->create(['is_active' => true, 'original_price' => 20000, 'deal_price' => 15000]);
    $deal->services()->attach($service->id);
    $a = GalleryImage::factory()->create(['gallery_id' => $gallery->id, 'linked_type' => 'service', 'linked_id' => $service->id]);
    $b = GalleryImage::factory()->create(['gallery_id' => $gallery->id, 'linked_type' => 'deal', 'linked_id' => $deal->id]);

    $images = collect($this->get('/gallery')->viewData('page')['props']['sections'])->flatMap(fn ($sec) => $sec['images'])->keyBy('id');

    expect((float) $images[$a->id]['link']['price'])->toBe(10500.0)
        ->and($images[$a->id]['link']['duration_min'])->toBe(90)
        ->and((float) $images[$b->id]['link']['price'])->toBe(15000.0)
        ->and((float) $images[$b->id]['link']['original_price'])->toBe(20000.0)
        ->and($images[$b->id]['link'])->toHaveKeys(['savings_percent', 'ends_at', 'included_count'])
        ->and((float) $images[$b->id]['link']['deal']['deal_price'])->toBe(15000.0);
});
