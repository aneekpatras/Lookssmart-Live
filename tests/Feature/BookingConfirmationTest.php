<?php

use App\Actions\Booking\CreateBookingAction;
use App\Http\Controllers\BookingLinkController;
use App\Models\Booking;
use App\Models\BookingStatusLog;
use App\Models\BusinessHour;
use App\Models\Service;
use App\Models\ServiceCategory;
use App\Models\Setting;
use App\Models\Staff;
use App\Models\StaffWorkingHour;
use App\Models\User;
use App\Notifications\CustomerConfirmedBookingAlert;
use App\Services\PriceQuoteService;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Notification;
use Illuminate\Support\Facades\URL;

uses(RefreshDatabase::class);

beforeEach(function () {
    DB::table('slot_holds')->delete();
    $this->seed(RolesAndPermissionsSeeder::class);
});

/** @return array{0: Booking, 1: Staff, 2: Service, 3: CarbonImmutable} a pending booking 3 days from now at 10:00 UTC */
function confirmFixture(): array
{
    foreach (['booking.tax_rate' => 0, 'booking.slot_minutes' => 30, 'booking.min_lead_minutes' => 0, 'booking.max_advance_days' => 60, 'booking.max_bookings_per_slot' => 1] as $key => $value) {
        Setting::create(['key' => $key, 'value' => $value, 'group' => 'booking']);
    }
    $start = CarbonImmutable::now('UTC')->addDays(3)->setTime(10, 0);
    BusinessHour::firstOrCreate(['weekday' => $start->dayOfWeek], ['open_time' => '09:00:00', 'close_time' => '18:00:00', 'is_closed' => false]);

    $staff = Staff::factory()->create(['is_active' => true]);
    StaffWorkingHour::create(['staff_id' => $staff->id, 'weekday' => $start->dayOfWeek, 'start_time' => '09:00:00', 'end_time' => '18:00:00']);
    $service = Service::factory()->create(['service_category_id' => ServiceCategory::factory()->create()->id, 'duration_min' => 30, 'buffer_min' => 0, 'base_price' => 50]);
    $staff->services()->attach($service->id);

    $booking = app(CreateBookingAction::class)->execute(
        serviceIds: [$service->id],
        staffId: $staff->id,
        startsAt: $start,
        quote: app(PriceQuoteService::class)->quote([$service->id]),
        timezone: 'UTC',
        source: 'website',
        guestName: 'Guest',
        guestEmail: 'guest@example.com',
    );

    return [$booking, $staff, $service, $start];
}

function adminUserForConfirm(): User
{
    $admin = User::factory()->create(['email_verified_at' => now()]);
    $admin->assignRole('super-admin');

    return $admin;
}

it('shows the signed page for a valid link and never changes anything on GET', function () {
    [$booking] = confirmFixture();
    expect($booking->status)->toBe('pending');

    $this->get(BookingLinkController::url($booking))
        ->assertOk()
        ->assertHeader('X-Robots-Tag', 'noindex, nofollow')
        ->assertInertia(fn ($page) => $page
            ->component('Public/BookingLink')
            ->where('invalid', false)
            ->where('booking.code', $booking->code)
            ->where('booking.can_confirm', true)
            ->missing('booking.guest_email')
            ->missing('booking.guest_phone'));

    expect($booking->fresh()->status)->toBe('pending')->and($booking->fresh()->confirmed_at)->toBeNull();
});

it('refuses tampered and expired links with a friendly 403 page', function () {
    [$booking] = confirmFixture();

    $this->get(BookingLinkController::url($booking) . '&x=1')
        ->assertForbidden()
        ->assertInertia(fn ($page) => $page->where('invalid', true));

    $expired = URL::temporarySignedRoute('booking.link.show', now()->subMinute(), ['booking' => $booking->code]);
    $this->get($expired)->assertForbidden()->assertInertia(fn ($page) => $page->where('invalid', true));

    $this->postJson(route('booking.link.confirm', $booking->code))->assertForbidden();
    expect($booking->fresh()->status)->toBe('pending');
});

it('confirms on POST once, records how, tells staff, and is idempotent', function () {
    [$booking] = confirmFixture();
    $admin = adminUserForConfirm();
    Notification::fake();
    $url = BookingLinkController::url($booking, 'booking.link.confirm');

    $this->postJson($url)->assertOk()->assertJson(['result' => 'confirmed', 'status' => 'confirmed']);

    $fresh = $booking->fresh();
    expect($fresh->status)->toBe('confirmed')
        ->and($fresh->confirmed_via)->toBe('customer_email')
        ->and($fresh->confirmed_at)->not->toBeNull()
        ->and($fresh->confirmed_by)->toBeNull();
    Notification::assertSentTo($admin, CustomerConfirmedBookingAlert::class);

    $this->postJson($url)->assertOk()->assertJson(['result' => 'already']);
    Notification::assertSentToTimes($admin, CustomerConfirmedBookingAlert::class, 1);
    expect(BookingStatusLog::where('booking_id', $booking->id)->where('to_status', 'confirmed')->count())->toBe(1);
});

it('refuses to confirm cancelled, completed or past bookings', function () {
    [$booking] = confirmFixture();
    $url = BookingLinkController::url($booking, 'booking.link.confirm');

    $booking->forceFill(['status' => 'cancelled'])->save();
    $this->postJson($url)->assertStatus(422);

    $booking->forceFill(['status' => 'pending', 'starts_at' => now()->subHour(), 'ends_at' => now()->addMinutes(10)])->save();
    $this->postJson($url)->assertStatus(422);
    expect($booking->fresh()->status)->toBe('pending');
});

it('lets the owner move their booking, keeps the status, logs it, and counts the own slot as free', function () {
    [$booking, $staff, $service, $start] = confirmFixture();
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $booking->forceFill(['customer_id' => $customer->id, 'status' => 'confirmed'])->save();
    Notification::fake();

    $day = $start->toDateString();
    $slots = $this->actingAs($customer)->postJson("/my-bookings/{$booking->code}/slots", ['date' => $day, 'timezone' => 'UTC'])
        ->assertOk()->json('slots');
    $own = collect($slots)->first(fn ($s) => CarbonImmutable::parse($s['starts_at'])->equalTo($start));
    expect($own['is_available'])->toBeTrue(); // cap is 1 and the only booking is this one

    // Move to 10:30: overlaps nothing but the booking's own old slot window edge; use 10:00 -> 10:30.
    $newStart = $start->addMinutes(30);
    $this->actingAs($customer)->postJson("/my-bookings/{$booking->code}/reschedule", ['starts_at' => $newStart->toIso8601String(), 'timezone' => 'UTC'])
        ->assertOk()->assertJson(['status' => 'confirmed']);

    $fresh = $booking->fresh();
    expect($fresh->starts_at->equalTo($newStart))->toBeTrue()->and($fresh->status)->toBe('confirmed');
    expect(BookingStatusLog::where('booking_id', $booking->id)->where('reason', 'like', 'Rescheduled by customer:%')->exists())->toBeTrue();
});

it('rejects reschedules by other users, for cancelled or past bookings, and into a full slot', function () {
    [$booking, $staff, $service, $start] = confirmFixture();
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $stranger = User::factory()->create(['email_verified_at' => now()]);
    $booking->forceFill(['customer_id' => $owner->id])->save();
    $body = ['starts_at' => $start->addHour()->toIso8601String(), 'timezone' => 'UTC'];

    $this->actingAs($stranger)->postJson("/my-bookings/{$booking->code}/reschedule", $body)->assertForbidden();

    // A different booking fills 11:00 (cap is 1), so moving there is refused.
    $other = app(CreateBookingAction::class)->execute(
        serviceIds: [$service->id], staffId: $staff->id, startsAt: $start->addHour(),
        quote: app(PriceQuoteService::class)->quote([$service->id]), timezone: 'UTC', source: 'website',
        guestName: 'Other', guestEmail: 'other@example.com',
    );
    expect($other->exists)->toBeTrue();
    $this->actingAs($owner)->postJson("/my-bookings/{$booking->code}/reschedule", $body)->assertStatus(409);

    $booking->forceFill(['status' => 'cancelled'])->save();
    $this->actingAs($owner)->postJson("/my-bookings/{$booking->code}/reschedule", ['starts_at' => $start->addHours(3)->toIso8601String(), 'timezone' => 'UTC'])->assertStatus(422);

    $booking->forceFill(['status' => 'pending', 'starts_at' => now()->subHours(2), 'ends_at' => now()->subHour()])->save();
    $this->actingAs($owner)->postJson("/my-bookings/{$booking->code}/reschedule", ['starts_at' => $start->addHours(3)->toIso8601String(), 'timezone' => 'UTC'])->assertStatus(422);
});

it('refuses reschedules closer than booking.reschedule_min_hours and points to WhatsApp', function () {
    [$booking, , , $start] = confirmFixture();
    $owner = User::factory()->create(['email_verified_at' => now()]);
    $booking->forceFill(['customer_id' => $owner->id])->save();
    Setting::create(['key' => 'booking.reschedule_min_hours', 'value' => 500, 'group' => 'booking']);

    $response = $this->actingAs($owner)->postJson("/my-bookings/{$booking->code}/reschedule", ['starts_at' => $start->addHours(2)->toIso8601String(), 'timezone' => 'UTC'])
        ->assertStatus(422);
    expect($response->json('message'))->toContain('WhatsApp');
    expect($booking->fresh()->starts_at->equalTo($start))->toBeTrue();
});

it('lets a guest reschedule from the signed link and keeps the booking pending', function () {
    [$booking, , , $start] = confirmFixture();
    $newStart = $start->addHours(2);

    $this->postJson(BookingLinkController::url($booking, 'booking.link.reschedule'), ['starts_at' => $newStart->toIso8601String(), 'timezone' => 'UTC'])
        ->assertOk()->assertJson(['status' => 'pending']);
    expect($booking->fresh()->starts_at->equalTo($newStart))->toBeTrue();

    $this->postJson(route('booking.link.reschedule', $booking->code), ['starts_at' => $start->toIso8601String(), 'timezone' => 'UTC'])->assertForbidden();
});

it('puts a confirm button in the booking email for pending bookings only', function () {
    [$booking] = confirmFixture();
    $mail = (new \App\Notifications\BookingConfirmed($booking))->toMail(User::factory()->create());
    $html = (string) $mail->render();
    expect($html)->toContain('Confirm my booking')->toContain('Reschedule')->toContain('/b/' . $booking->code);

    $booking->forceFill(['status' => 'confirmed'])->save();
    $html = (string) (new \App\Notifications\BookingConfirmed($booking->fresh()))->toMail(User::factory()->create())->render();
    expect($html)->not->toContain('Confirm my booking')->toContain('Reschedule');
});

it('lists pending bookings on the To confirm tab, logs the WhatsApp ask, and lets staff mark confirmed', function () {
    [$booking] = confirmFixture();
    $admin = adminUserForConfirm();

    $this->actingAs($admin)->get('/admin/reminders')->assertOk()->assertInertia(fn ($page) => $page
        ->has('toConfirm', 1)
        ->where('toConfirm.0.ref', $booking->code)
        ->where('toConfirm.0.has_email', true)
        ->where('templates.defaults.confirm', fn ($text) => str_contains($text, '{ref}')));

    $this->actingAs($admin)->postJson('/admin/reminders/log', [
        'type' => 'confirm', 'booking_id' => $booking->id, 'phone' => '923001234567', 'message' => 'Please confirm',
    ])->assertNoContent();
    expect(\App\Models\ManualMessageLog::where('type', 'confirm')->where('booking_id', $booking->id)->exists())->toBeTrue();

    $this->actingAs($admin)->post("/admin/reminders/bookings/{$booking->id}/confirm")->assertRedirect();
    $fresh = $booking->fresh();
    expect($fresh->status)->toBe('confirmed')
        ->and($fresh->confirmed_via)->toBe('staff')
        ->and($fresh->confirmed_by)->toBe($admin->id);

    $this->actingAs($admin)->get('/admin/reminders')->assertInertia(fn ($page) => $page->has('toConfirm', 0));
    $this->actingAs($admin)->get("/admin/bookings/{$booking->id}")->assertInertia(fn ($page) => $page->where('booking.confirmation.by', $admin->name));
});
