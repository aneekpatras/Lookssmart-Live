<?php

use App\Models\Booking;
use App\Models\Deal;
use App\Models\BusinessHour;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Setting;
use App\Models\Staff;
use App\Models\StaffWorkingHour;
use App\Models\User;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

/**
 * Covers the real, backend-observable parts of the "single-step booking overhaul" task: the new
 * `notes` field genuinely persists through a real booking, and every booking a customer creates or
 * cancels is immediately visible to the admin bookings list — proving "admin sync" is real rather
 * than assumed, since `AdminBookingController::index()` has no caching layer to invalidate in the
 * first place (a plain fresh Eloquent query every visit).
 */
function bookableSlot(): array
{
    // +3 days rather than +1: guarantees >24h away regardless of what time-of-day the test suite
    // actually runs at, which matters for the cancellation-window assertions below.
    $day = CarbonImmutable::now('UTC')->addDays(3);
    BusinessHour::firstOrCreate(
        ['weekday' => $day->dayOfWeek],
        ['open_time' => '09:00:00', 'close_time' => '18:00:00', 'is_closed' => false],
    );

    $staff = Staff::factory()->create(['is_active' => true]);
    StaffWorkingHour::create([
        'staff_id' => $staff->id, 'weekday' => $day->dayOfWeek,
        'start_time' => '09:00:00', 'end_time' => '18:00:00',
    ]);

    $category = ServiceCategory::factory()->create(['name' => 'Hair', 'is_active' => true]);
    $service = Service::factory()->create([
        'service_category_id' => $category->id, 'name' => 'Signature Cut',
        'duration_min' => 30, 'buffer_min' => 0, 'base_price' => 45, 'is_active' => true,
    ]);
    $staff->services()->attach($service->id);

    return ['staff' => $staff, 'service' => $service, 'startsAt' => $day->setTime(9, 0)];
}

beforeEach(function () {
    Setting::firstOrCreate(['key' => 'booking.tax_rate'], ['value' => 0, 'group' => 'booking']);
    Setting::firstOrCreate(['key' => 'booking.slot_minutes'], ['value' => 15, 'group' => 'booking']);
    Setting::firstOrCreate(['key' => 'booking.min_lead_minutes'], ['value' => 0, 'group' => 'booking']);
    Setting::firstOrCreate(['key' => 'booking.max_advance_days'], ['value' => 60, 'group' => 'booking']);
    Setting::firstOrCreate(['key' => 'booking.hold_minutes'], ['value' => 5, 'group' => 'booking']);
    Setting::firstOrCreate(['key' => 'booking.cancellation_window_hours'], ['value' => 24, 'group' => 'booking']);
});

it('persists the customer-supplied notes onto the real booking row', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $service, 'startsAt' => $startsAt] = bookableSlot();
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');

    $quote = $this->actingAs($customer)->postJson('/api/booking/quote', [
        'service_ids' => [$service->id],
    ])->assertOk()->json();

    $store = $this->actingAs($customer)->postJson('/api/booking', [
        'service_ids' => [$service->id],
        'staff_id' => $staff->id,
        'starts_at' => $startsAt->toIso8601String(),
        'timezone' => 'UTC',
        'guest_phone' => '03001234567',
        'notes' => 'Please use fragrance-free products — sensitive skin.',
        'quote' => $quote,
    ])->assertCreated();

    $booking = Booking::where('code', $store->json('code'))->first();
    expect($booking->notes)->toBe('Please use fragrance-free products — sensitive skin.');
});

it('folds the customer-supplied subject onto the notes field, since bookings has no dedicated subject column', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $service, 'startsAt' => $startsAt] = bookableSlot();
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');

    $quote = $this->actingAs($customer)->postJson('/api/booking/quote', [
        'service_ids' => [$service->id],
    ])->assertOk()->json();

    $store = $this->actingAs($customer)->postJson('/api/booking', [
        'service_ids' => [$service->id],
        'staff_id' => $staff->id,
        'starts_at' => $startsAt->toIso8601String(),
        'timezone' => 'UTC',
        'guest_phone' => '03001234567',
        'subject' => 'First-time visit question',
        'notes' => 'I have a nut allergy.',
        'quote' => $quote,
    ])->assertCreated();

    $booking = Booking::where('code', $store->json('code'))->first();
    expect($booking->notes)->toBe("Subject: First-time visit question\n\nI have a nut allergy.");
});

it('folds only the subject onto notes when no separate notes text was given', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $service, 'startsAt' => $startsAt] = bookableSlot();
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');

    $quote = $this->actingAs($customer)->postJson('/api/booking/quote', [
        'service_ids' => [$service->id],
    ])->assertOk()->json();

    $store = $this->actingAs($customer)->postJson('/api/booking', [
        'service_ids' => [$service->id],
        'staff_id' => $staff->id,
        'starts_at' => $startsAt->toIso8601String(),
        'timezone' => 'UTC',
        'guest_phone' => '03001234567',
        'subject' => 'Just a subject, no notes',
        'quote' => $quote,
    ])->assertCreated();

    $booking = Booking::where('code', $store->json('code'))->first();
    expect($booking->notes)->toBe('Subject: Just a subject, no notes');
});

it('creates a booking with no notes at all when the field is omitted, without error', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $service, 'startsAt' => $startsAt] = bookableSlot();
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');

    $quote = $this->actingAs($customer)->postJson('/api/booking/quote', [
        'service_ids' => [$service->id],
    ])->assertOk()->json();

    $store = $this->actingAs($customer)->postJson('/api/booking', [
        'service_ids' => [$service->id],
        'staff_id' => $staff->id,
        'starts_at' => $startsAt->toIso8601String(),
        'timezone' => 'UTC',
        'guest_phone' => '03001234567',
        'quote' => $quote,
    ])->assertCreated();

    expect(Booking::where('code', $store->json('code'))->first()->notes)->toBeNull();
});

it('reflects a customer-created booking on the admin bookings list immediately, with no separate sync step', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $service, 'startsAt' => $startsAt] = bookableSlot();
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');
    $admin = User::factory()->create([
        'email_verified_at' => now(), 'two_factor_secret' => encrypt('test-secret'),
        'two_factor_confirmed_at' => now(),
    ]);
    $admin->assignRole('admin');

    $quote = $this->actingAs($customer)->postJson('/api/booking/quote', [
        'service_ids' => [$service->id],
    ])->assertOk()->json();

    $store = $this->actingAs($customer)->postJson('/api/booking', [
        'service_ids' => [$service->id],
        'staff_id' => $staff->id,
        'starts_at' => $startsAt->toIso8601String(),
        'timezone' => 'UTC',
        'guest_phone' => '03001234567',
        'quote' => $quote,
    ])->assertCreated();
    $code = $store->json('code');

    // A genuinely separate request from a different (admin) user session — no shared process state,
    // no cache to warm — proving the admin list is reading the real, just-committed row.
    $this->actingAs($admin)->get('/admin/bookings')->assertOk()->assertInertia(fn ($page) => $page
        ->where('bookings.data.0.code', $code)
        ->where('bookings.data.0.status', 'pending'));

    // Cancelling as the customer is reflected on the admin list immediately too, still with no
    // manual sync/refresh step beyond the admin's own next page visit.
    $this->actingAs($customer)->postJson("/api/booking/{$code}/cancel", ['reason' => 'Change of plans'])
        ->assertOk();

    $this->actingAs($admin)->get('/admin/bookings?status=cancelled')->assertInertia(fn ($page) => $page
        ->where('bookings.data.0.code', $code)
        ->where('bookings.data.0.status', 'cancelled'));
});

it('creates and links an account, and logs the guest in, only when the checkbox is ticked', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $service, 'startsAt' => $startsAt] = bookableSlot();

    $quote = $this->postJson('/api/booking/quote', ['service_ids' => [$service->id]])->assertOk()->json();
    $payload = fn (array $extra = []) => [
        'service_ids' => [$service->id],
        'staff_id' => $staff->id,
        'starts_at' => $startsAt->toIso8601String(),
        'timezone' => 'UTC',
        'guest_name' => 'Sara Ahmed',
        'guest_phone' => '03001234567',
        'guest_email' => 'sara@example.test',
        'quote' => $quote,
        ...$extra,
    ];

    // Weak password -> clear validation error, nothing created, booking untouched.
    $this->postJson('/api/booking', $payload([
        'create_account' => true, 'password' => 'short', 'password_confirmation' => 'short',
    ]))->assertUnprocessable()->assertJsonValidationErrors('password');
    expect(User::where('email', 'sara@example.test')->exists())->toBeFalse();

    $response = $this->postJson('/api/booking', $payload([
        'create_account' => true, 'password' => 'Velvet#Rose48', 'password_confirmation' => 'Velvet#Rose48',
    ]))->assertCreated()->assertJsonPath('account_created', true);

    $user = User::where('email', 'sara@example.test')->firstOrFail();
    expect(Booking::where('code', $response->json('code'))->first()->customer_id)->toBe($user->id);
    $this->assertAuthenticatedAs($user);

    // Same email again -> clear "already has an account" error.
    auth()->logout();
    $this->postJson('/api/booking', $payload([
        'create_account' => true, 'password' => 'Velvet#Rose48', 'password_confirmation' => 'Velvet#Rose48',
    ]))->assertUnprocessable()->assertJsonValidationErrors('guest_email');
});

it('books as a plain guest (no account) when the checkbox is not ticked', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $service, 'startsAt' => $startsAt] = bookableSlot();
    $quote = $this->postJson('/api/booking/quote', ['service_ids' => [$service->id]])->assertOk()->json();

    $response = $this->postJson('/api/booking', [
        'service_ids' => [$service->id], 'staff_id' => $staff->id,
        'starts_at' => $startsAt->toIso8601String(), 'timezone' => 'UTC',
        'guest_name' => 'Guest Only', 'guest_phone' => '03001234567', 'quote' => $quote,
    ])->assertCreated()->assertJsonPath('account_created', false);

    expect(Booking::where('code', $response->json('code'))->first()->customer_id)->toBeNull();
    $this->assertGuest();
});

it('creates an account from the WhatsApp number alone when no email is given (like /register)', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $service, 'startsAt' => $startsAt] = bookableSlot();
    $quote = $this->postJson('/api/booking/quote', ['service_ids' => [$service->id]])->assertOk()->json();

    $response = $this->postJson('/api/booking', [
        'service_ids' => [$service->id], 'staff_id' => $staff->id,
        'starts_at' => $startsAt->toIso8601String(), 'timezone' => 'UTC',
        'guest_name' => 'Phone Only', 'guest_phone' => '03007654321', 'quote' => $quote,
        'create_account' => true, 'password' => 'Velvet#Rose48', 'password_confirmation' => 'Velvet#Rose48',
    ])->assertCreated()->assertJsonPath('account_created', true);

    $user = User::where('name', 'Phone Only')->firstOrFail();
    expect($user->email)->toBeNull()
        ->and(Booking::where('code', $response->json('code'))->first()->customer_id)->toBe($user->id);
});

it('prices several cart deals server-side, saves the deal total, and shows the breakdown on my-bookings', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $first, 'startsAt' => $startsAt] = bookableSlot();
    $second = Service::factory()->create(['service_category_id' => $first->service_category_id, 'name' => 'Blow Dry', 'duration_min' => 30, 'buffer_min' => 0, 'base_price' => 55, 'is_active' => true]);
    $third = Service::factory()->create(['service_category_id' => $first->service_category_id, 'name' => 'Facial', 'duration_min' => 30, 'buffer_min' => 0, 'base_price' => 100, 'is_active' => true]);
    $fourth = Service::factory()->create(['service_category_id' => $first->service_category_id, 'name' => 'Wax', 'duration_min' => 30, 'buffer_min' => 0, 'base_price' => 40, 'is_active' => true]);
    foreach ([$second, $third, $fourth] as $service) {
        $staff->services()->attach($service->id);
    }

    // Two disjoint deals: (45 + 55 = 100 -> 80) and (100 + 40 = 140 -> 120); total catalog 240 -> 200.
    $dealA = Deal::factory()->create(['title' => 'Cut Combo', 'code' => 'CUTCOMBO', 'type' => 'fixed', 'value' => 20, 'original_price' => 100, 'deal_price' => 80, 'usage_limit' => null, 'per_user_limit' => null, 'min_amount' => null, 'is_auto_apply' => false, 'is_active' => true, 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()]);
    $dealA->services()->sync([$first->id, $second->id]);
    $dealB = Deal::factory()->create(['title' => 'Glow Combo', 'code' => 'GLOWCOMBO', 'type' => 'fixed', 'value' => 20, 'original_price' => 140, 'deal_price' => 120, 'usage_limit' => null, 'per_user_limit' => null, 'min_amount' => null, 'is_auto_apply' => false, 'is_active' => true, 'starts_at' => now()->subDay(), 'ends_at' => now()->addMonth()]);
    $dealB->services()->sync([$third->id, $fourth->id]);

    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');
    $ids = [$first->id, $second->id, $third->id, $fourth->id];

    // Without deal ids the server would charge the full catalog sum.
    $this->actingAs($customer)->postJson('/api/booking/quote', ['service_ids' => $ids])
        ->assertOk()->assertJsonPath('total', 240);

    $quote = $this->actingAs($customer)->postJson('/api/booking/quote', [
        'service_ids' => $ids, 'deal_ids' => [$dealA->id, $dealB->id], 'code' => 'CUTCOMBO',
    ])->assertOk()->assertJsonPath('subtotal', 240)->assertJsonPath('discount', 40)->assertJsonPath('total', 200)->json();

    $store = $this->actingAs($customer)->postJson('/api/booking', [
        'service_ids' => $ids, 'staff_id' => $staff->id,
        'starts_at' => $startsAt->toIso8601String(), 'timezone' => 'UTC',
        'guest_phone' => '03001234567', 'quote' => $quote,
    ])->assertCreated()->assertJsonPath('total', '200.00');

    $booking = Booking::where('code', $store->json('code'))->first();
    expect($booking->dealRedemptions()->count())->toBe(2);

    $page = $this->actingAs($customer)->get('/my-bookings')->viewData('page')['props']['bookings']['data'][0];
    expect($page['total'])->toBe('200.00')
        ->and($page['items'])->toHaveCount(4)
        ->and(collect($page['deals'])->pluck('title')->sort()->values()->all())->toBe(['Cut Combo', 'Glow Combo'])
        ->and(collect($page['deals'])->pluck('price')->sort()->values()->all())->toBe(['80.00', '120.00']);
});

it('shows a checkout-created account and a guest-with-email booking in Admin Customers, and leaves Leads alone', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    ['staff' => $staff, 'service' => $service, 'startsAt' => $startsAt] = bookableSlot();
    $quote = fn () => $this->postJson('/api/booking/quote', ['service_ids' => [$service->id]])->assertOk()->json();

    // 1) account created at checkout
    $this->postJson('/api/booking', [
        'service_ids' => [$service->id], 'staff_id' => $staff->id, 'starts_at' => $startsAt->toIso8601String(),
        'timezone' => 'UTC', 'guest_name' => 'Acct Maker', 'guest_phone' => '03005550001', 'guest_email' => 'acct@example.test',
        'quote' => $quote(), 'create_account' => true, 'password' => 'Velvet#Rose48', 'password_confirmation' => 'Velvet#Rose48',
    ])->assertCreated();
    auth()->logout();

    // 2) plain guest who left an email (gets a password-less customer record, no phone on the user row)
    $this->postJson('/api/booking', [
        'service_ids' => [$service->id], 'staff_id' => $staff->id, 'starts_at' => $startsAt->addHour()->toIso8601String(),
        'timezone' => 'UTC', 'guest_name' => 'Guest Email', 'guest_phone' => '03005550002', 'guest_email' => 'guest@example.test',
        'quote' => $quote(),
    ])->assertCreated();

    $admin = User::factory()->create(['email_verified_at' => now()]);
    $admin->assignRole('admin');

    $customers = collect($this->actingAs($admin)->get('/admin/customers')->viewData('page')['props']['customers']);
    expect($customers->firstWhere('email', 'acct@example.test'))->not->toBeNull()
        ->and($customers->firstWhere('email', 'acct@example.test')['name'])->toBe('Acct Maker')
        ->and($customers->firstWhere('email', 'guest@example.test')['phone'])->not->toBeNull();

    // Leads come only from the contact form — bookings never create one.
    expect(\App\Models\Lead::count())->toBe(0);
    $this->actingAs($admin)->get('/admin/leads')->assertOk();
});
