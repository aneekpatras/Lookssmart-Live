<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

/**
 * Live runs this code before (or without) the newest database changes. Every public page must still
 * render when those tables/columns are missing; only admin pages may show their "run the SQL" notice.
 */
it('renders the public site when the newer tables and columns do not exist', function () {
    Schema::disableForeignKeyConstraints();
    foreach (['faqs', 'faq_categories', 'site_events', 'incomplete_bookings', 'security_events', 'visitor_sessions', 'contact_drafts', 'manual_message_logs'] as $table) {
        Schema::dropIfExists($table);
    }
    Schema::enableForeignKeyConstraints();

    foreach (['specialty', 'linked_type', 'linked_id'] as $column) {
        if (Schema::hasColumn('gallery_images', $column)) {
            Schema::table('gallery_images', fn ($t) => $t->dropColumn($column));
        }
    }

    // users.phone and its unique index. users.email stays NOT NULL here, which matches live.
    if (Schema::hasColumn('users', 'phone')) {
        Schema::table('users', function ($t) {
            $t->dropUnique(['phone']);
        });
        Schema::table('users', fn ($t) => $t->dropColumn('phone'));
    }

    foreach (['/', '/faqs', '/services', '/deals', '/gallery', '/blog', '/contact', '/book', '/login', '/register', '/about', '/sitemap.xml'] as $url) {
        $this->get($url)->assertOk();
    }
    $this->get('/this-page-does-not-exist')->assertNotFound();

    // Register by email, then log in by email and by a phone number: none of it may be a 500.
    Role::findOrCreate('customer', 'web');
    $this->post('/register', [
        'name' => 'Test Customer',
        'email' => 'new@example.com',
        'phone' => '03001234567',
        'password' => 'Str0ng!Passw0rd#2026',
        'password_confirmation' => 'Str0ng!Passw0rd#2026',
    ])->assertRedirect();
    expect(User::where('email', 'new@example.com')->exists())->toBeTrue();
    auth()->logout();
    expect($this->post('/login', ['email' => '03001234567', 'password' => 'x'])->status())->toBeLessThan(500);
    expect($this->post('/login', ['email' => 'new@example.com', 'password' => 'Str0ng!Passw0rd#2026'])->status())->toBeLessThan(500);

    foreach (['/track', '/track/incomplete', '/track/contact'] as $url) {
        $status = $this->postJson($url, ['session_id' => 'abcdefgh12345678', 'event' => 'session_start', 'path' => '/'])->status();
        expect($status)->toBeLessThan(500);
    }
});

it('keeps the booking flow, signed booking page, My Bookings and reminders working without the confirmation columns', function () {
    $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');
    $admin = User::factory()->create(['email_verified_at' => now(), 'two_factor_secret' => encrypt('s'), 'two_factor_confirmed_at' => now()]);
    $admin->assignRole('super-admin');

    $start = now()->addDays(4)->setTime(15, 0);
    $booking = \App\Models\Booking::factory()->create([
        'staff_id' => \App\Models\Staff::factory()->create()->id, 'customer_id' => $customer->id,
        'status' => 'pending', 'starts_at' => $start, 'ends_at' => $start->copy()->addHour(),
    ]);
    \App\Models\ReminderRule::create(['event' => 'before_booking', 'direction' => 'before', 'offset_minutes' => 1440, 'channels' => ['email'], 'template' => 'r', 'is_active' => true]);

    foreach (['confirmed_by', 'confirmed_via', 'confirmed_at'] as $column) {
        if (Schema::hasColumn('bookings', $column)) {
            Schema::table('bookings', fn ($t) => $t->dropColumn($column));
        }
    }
    expect(\App\Models\Booking::hasConfirmationColumns())->toBeFalse();

    $this->get('/book')->assertOk();
    $this->get(\App\Http\Controllers\BookingLinkController::url($booking))->assertOk();
    $this->actingAs($customer)->get('/my-bookings')->assertOk();
    $this->artisan('bookings:send-reminders')->assertExitCode(0);
    expect(app(\App\Services\BookingReminderSchedule::class)->upcoming(now(), 20))->toBeArray();

    $this->actingAs($admin)->get('/admin/reminders')->assertOk();
    $this->actingAs($admin)->get("/admin/bookings/{$booking->id}")->assertOk();

    // Confirming from the email link still works (it just cannot record how).
    auth()->logout();
    $this->postJson(\App\Http\Controllers\BookingLinkController::url($booking, 'booking.link.confirm'))->assertOk()->assertJson(['status' => 'confirmed']);
});
