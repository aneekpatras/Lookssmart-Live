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
