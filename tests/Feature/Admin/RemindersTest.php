<?php

use App\Models\Booking;
use App\Models\CustomerProfile;
use App\Models\ManualMessageLog;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

function remindersAdmin(): User
{
    test()->seed(RolesAndPermissionsSeeder::class);
    $user = User::factory()->create([
        'email_verified_at' => now(),
        'two_factor_secret' => encrypt('s'),
        'two_factor_confirmed_at' => now(),
    ]);
    $user->assignRole('super-admin');

    return $user;
}

it('lists tomorrow appointments with a filled WhatsApp message and logs a click', function () {
    $admin = remindersAdmin();
    $start = CarbonImmutable::now('Asia/Karachi')->addDay()->setTime(15, 0)->utc();
    $booking = Booking::create([
        'code' => 'LS-REM001', 'guest_name' => 'Sana', 'guest_phone' => '923001234567',
        'starts_at' => $start, 'ends_at' => $start->addHour(), 'status' => 'confirmed', 'total' => 1000,
    ]);

    $this->actingAs($admin)->get('/admin/reminders')->assertInertia(fn ($page) => $page
        ->component('Admin/Reminders')
        ->where('appointments.0.wa_phone', '923001234567')
        ->where('appointments.0.time', fn ($t) => str_contains($t, '3:00 PM'))
        ->where('appointments.0.sent', null)
        ->where('appointments.0.message', fn ($m) => str_contains($m, 'Sana') && ! str_contains($m, '{')));

    $this->actingAs($admin)->postJson('/admin/reminders/log', [
        'type' => 'reminder', 'booking_id' => $booking->id, 'phone' => '923001234567', 'message' => 'hello',
    ])->assertNoContent();

    expect(ManualMessageLog::count())->toBe(1);
    $this->actingAs($admin)->get('/admin/reminders')->assertInertia(fn ($page) => $page
        ->where('appointments.0.sent.by', $admin->name));
});

it('excludes cancelled bookings and rejects logs for unknown bookings', function () {
    $admin = remindersAdmin();
    $start = CarbonImmutable::now('Asia/Karachi')->addDay()->setTime(10, 0)->utc();
    Booking::create([
        'code' => 'LS-REM002', 'guest_name' => 'Gone', 'guest_phone' => '923001234567',
        'starts_at' => $start, 'ends_at' => $start->addHour(), 'status' => 'cancelled', 'total' => 1000,
    ]);

    $this->actingAs($admin)->get('/admin/reminders')->assertInertia(fn ($page) => $page->has('appointments', 0));
    $this->actingAs($admin)->postJson('/admin/reminders/log', [
        'type' => 'reminder', 'booking_id' => 9999, 'phone' => '923001234567', 'message' => 'x',
    ])->assertStatus(422);
});

it('lists a birthday today, saves a template and resets it', function () {
    $admin = remindersAdmin();
    $customer = User::factory()->create(['phone' => '03001234567']);
    $customer->assignRole('customer');
    CustomerProfile::create(['user_id' => $customer->id, 'dob' => CarbonImmutable::now('Asia/Karachi')->subYears(30)->toDateString()]);

    $this->actingAs($admin)->get('/admin/reminders')->assertInertia(fn ($page) => $page
        ->where('birthdays.rows.0.days', 0)
        ->where('birthdays.rows.0.age', 30)
        ->where('birthdays.rows.0.wa_phone', '923001234567'));

    $this->actingAs($admin)->post('/admin/reminders/templates', ['key' => 'birthday', 'value' => 'Happy birthday {name}!']);
    $this->actingAs($admin)->get('/admin/reminders')->assertInertia(fn ($page) => $page
        ->where('birthdays.rows.0.message', 'Happy birthday ' . $customer->name . '!'));

    $this->actingAs($admin)->post('/admin/reminders/templates', ['key' => 'birthday', 'value' => '']);
    $this->actingAs($admin)->get('/admin/reminders')->assertInertia(fn ($page) => $page
        ->where('templates.birthday', fn ($t) => str_starts_with($t, 'Salgirah mubarak')));
});
