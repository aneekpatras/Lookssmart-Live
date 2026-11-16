<?php

use App\Models\Deal;
use App\Models\Gallery;
use App\Models\GalleryImage;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Setting;
use App\Models\ShowcaseSlide;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;

uses(RefreshDatabase::class);

function showcaseAdmin(): User
{
    test()->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create(['email_verified_at' => now(), 'two_factor_secret' => encrypt('s'), 'two_factor_confirmed_at' => now()]);
    $user->assignRole('admin');

    return $user;
}

it('lists active slides in their sort order and skips inactive ones', function () {
    ShowcaseSlide::create(['image_path' => 'showcase/b.jpg', 'title' => 'Second', 'sort_order' => 2, 'focus' => 'top', 'is_active' => true]);
    ShowcaseSlide::create(['image_path' => 'showcase/a.jpg', 'title' => 'First', 'sort_order' => 1, 'focus' => 'center', 'is_active' => true]);
    ShowcaseSlide::create(['image_path' => 'showcase/c.jpg', 'title' => 'Hidden', 'sort_order' => 0, 'focus' => 'top', 'is_active' => false]);

    $this->get('/')->assertOk()->assertInertia(fn ($page) => $page
        ->has('showcase.slides', 2)
        ->where('showcase.slides.0.title', 'First')
        ->where('showcase.slides.0.focus', 'center')
        ->where('showcase.slides.1.title', 'Second'));
});

it('falls back to the gallery photos marked for the homepage, and hides the image column when there are none', function () {
    $this->get('/')->assertInertia(fn ($page) => $page->has('showcase.slides', 0)->has('showcase.options'));

    $gallery = Gallery::factory()->create(['is_active' => true]);
    GalleryImage::factory()->create(['gallery_id' => $gallery->id, 'show_on_homepage' => true, 'caption' => 'Bridal look']);

    $this->get('/')->assertInertia(fn ($page) => $page
        ->has('showcase.slides', 1)
        ->where('showcase.slides.0.title', 'Bridal look'));
});

it('builds the chips from active categories that have an active service, linking to the category anchors', function () {
    $with = ServiceCategory::factory()->create(['name' => 'Bridal', 'is_active' => true]);
    Service::factory()->create(['service_category_id' => $with->id, 'is_active' => true]);
    ServiceCategory::factory()->create(['name' => 'Empty', 'is_active' => true]);

    $this->get('/')->assertInertia(fn ($page) => $page
        ->has('showcase.chips', 1)
        ->where('showcase.chips.0.id', $with->id)
        ->where('showcase.chips.0.name', 'Bridal'));

    Setting::create(['key' => 'showcase.chips_enabled', 'value' => false, 'group' => 'showcase', 'is_encrypted' => false]);
    $this->get('/')->assertInertia(fn ($page) => $page->has('showcase.chips', 0));
});

it('shows the deal card for the top live deal and hides it with no live deal or when switched off', function () {
    $this->get('/')->assertInertia(fn ($page) => $page->where('showcase.deal', null));

    Deal::factory()->create(['title' => 'Bridal Glow', 'is_active' => true, 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()]);
    $this->get('/')->assertInertia(fn ($page) => $page->where('showcase.deal.title', 'Bridal Glow'));

    Setting::create(['key' => 'showcase.deal_enabled', 'value' => false, 'group' => 'showcase', 'is_encrypted' => false]);
    $this->get('/')->assertInertia(fn ($page) => $page->where('showcase.deal', null));
});

it('hides the whole section when switched off and ignores an invalid saved link', function () {
    Setting::create(['key' => 'showcase.primary_url', 'value' => 'javascript:alert(1)', 'group' => 'showcase', 'is_encrypted' => false]);
    $this->get('/')->assertInertia(fn ($page) => $page->where('showcase.options.primary_url', '/book'));

    Setting::create(['key' => 'showcase.enabled', 'value' => false, 'group' => 'showcase', 'is_encrypted' => false]);
    $this->get('/')->assertInertia(fn ($page) => $page->where('showcase', null));
});

it('keeps the Home sections in order: showcase, banner, Special Deals, Services', function () {
    $source = file_get_contents(resource_path('js/Pages/Public/Home.tsx'));
    $positions = array_map(fn ($needle) => strpos($source, $needle), [
        '<HomeShowcase', '<DealsBar bar={dealsBar}', 'Special Deals', 'Our Specialized Services', 'Why Choose Us',
    ]);

    expect($positions)->each->not->toBeFalse();
    expect($positions)->toBe(collect($positions)->sort()->values()->all());
});

it('saves the showcase texts and rejects bad links, long text and out-of-range intervals', function () {
    $admin = showcaseAdmin();

    $this->actingAs($admin)->put('/admin/settings/showcase', ['settings' => [
        'showcase.eyebrow' => 'Hello', 'showcase.primary_url' => '/book', 'showcase.interval' => 7,
    ]])->assertSessionHasNoErrors();
    expect(Setting::get('showcase.eyebrow'))->toBe('Hello');

    foreach ([['showcase.primary_url', 'http://evil.test'], ['showcase.secondary_url', '//evil.test'], ['showcase.interval', 2], ['showcase.interval', 16], ['showcase.eyebrow', str_repeat('a', 81)], ['showcase.paragraph', '<b>x</b>']] as [$key, $value]) {
        $this->actingAs($admin)->put('/admin/settings/showcase', ['settings' => [$key => $value]])->assertSessionHasErrors("settings.{$key}");
    }
});

it('validates slides: image required, type and size, title and link', function () {
    Storage::fake('public');
    $admin = showcaseAdmin();

    $this->actingAs($admin)->post('/admin/showcase/slides', ['title' => 'No image', 'focus' => 'top'])->assertSessionHasErrors('image');
    $this->actingAs($admin)->post('/admin/showcase/slides', ['title' => 'Doc', 'focus' => 'top', 'image' => UploadedFile::fake()->create('a.pdf', 10, 'application/pdf')])->assertSessionHasErrors('image');
    $this->actingAs($admin)->post('/admin/showcase/slides', ['title' => 'Big', 'focus' => 'top', 'image' => UploadedFile::fake()->image('a.jpg', 900, 1200)->size(4000)])->assertSessionHasErrors('image');
    $image = fn () => UploadedFile::fake()->image('a.jpg', 900, 1200);
    $this->actingAs($admin)->post('/admin/showcase/slides', ['title' => '', 'focus' => 'top', 'image' => $image()])->assertSessionHasErrors('title');
    $this->actingAs($admin)->post('/admin/showcase/slides', ['title' => 'Bad link', 'link' => 'ftp://x', 'focus' => 'top', 'image' => $image()])->assertSessionHasErrors('link');
    $this->actingAs($admin)->post('/admin/showcase/slides', ['title' => 'Bad focus', 'focus' => 'left', 'image' => $image()])->assertSessionHasErrors('focus');

    $this->actingAs($admin)->post('/admin/showcase/slides', ['title' => '<i>Bridal</i> look', 'subtitle' => 'Sub', 'link' => '/gallery', 'focus' => 'center', 'image' => $image()])->assertSessionHasNoErrors();
    $slide = ShowcaseSlide::first();
    expect($slide->title)->toBe('Bridal look')->and($slide->focus)->toBe('center')->and($slide->link)->toBe('/gallery');
    Storage::disk('public')->assertExists($slide->image_path);

    $this->actingAs($admin)->put("/admin/showcase/slides/{$slide->id}", ['is_active' => false])->assertSessionHasNoErrors();
    expect($slide->fresh()->is_active)->toBeFalse();
    $this->actingAs($admin)->delete("/admin/showcase/slides/{$slide->id}");
    expect(ShowcaseSlide::count())->toBe(0);
});

it('shows the admin page to cms managers only', function () {
    $this->get('/admin/showcase')->assertRedirect();
    $this->actingAs(showcaseAdmin())->get('/admin/showcase')->assertOk();
});
