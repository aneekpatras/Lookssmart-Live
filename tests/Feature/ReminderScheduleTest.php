<?php

use App\Models\Booking;
use App\Models\NotificationLog;
use App\Models\ReminderRule;
use App\Models\Staff;
use App\Models\User;
use App\Notifications\BookingReminder;
use Carbon\CarbonImmutable;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Support\Facades\Notification;

uses(RefreshDatabase::class);

function reminderStart(): CarbonImmutable
{
    return CarbonImmutable::parse('2026-12-02 12:00:00', 'UTC');
}

function reminderRule(int $minutes, bool $active = true): ReminderRule
{
    return ReminderRule::create([
        'event' => 'before_booking', 'direction' => 'before', 'offset_minutes' => $minutes,
        'channels' => ['email'], 'template' => "r{$minutes}", 'is_active' => $active,
    ]);
}

function reminderBooking(array $overrides = []): Booking
{
    $start = $overrides['starts_at'] ?? reminderStart();
    $customer = array_key_exists('customer_id', $overrides) ? null : User::factory()->create(['email_verified_at' => now()]);

    $booking = Booking::factory()->create(array_merge([
        'staff_id' => Staff::factory()->create()->id,
        'customer_id' => $customer?->id,
        'status' => 'confirmed',
        'starts_at' => $start,
        'ends_at' => $start->addMinutes(45),
    ], $overrides));
    $booking->forceFill(['created_at' => $overrides['created_at'] ?? reminderStart()->subDays(10)])->save();

    return $booking->fresh();
}

function runReminders(CarbonImmutable $at): void
{
    test()->artisan('bookings:send-reminders', ['--now' => $at->toIso8601String()])->assertExitCode(0);
}

it('fires the 24h, 12h and 6h reminders once each, in their own window', function () {
    Notification::fake();
    reminderRule(1440);
    reminderRule(720);
    reminderRule(360);
    $booking = reminderBooking();
    $start = reminderStart();

    runReminders($start->subHours(24)->subMinutes(5)); // before the 24h window opens
    Notification::assertNothingSent();

    runReminders($start->subHours(24)->addMinutes(10));
    Notification::assertSentToTimes($booking->customer, BookingReminder::class, 1);

    runReminders($start->subHours(24)->addMinutes(20)); // same window again: no duplicate
    Notification::assertSentToTimes($booking->customer, BookingReminder::class, 1);

    runReminders($start->subHours(12)->addMinutes(5));
    Notification::assertSentToTimes($booking->customer, BookingReminder::class, 2);

    runReminders($start->subHours(6)->addMinutes(5));
    Notification::assertSentToTimes($booking->customer, BookingReminder::class, 3);
    expect(NotificationLog::where('reminder_key', 'like', "booking-reminder:{$booking->id}:%")->count())->toBe(3);
});

it('never sends a late reminder when the scheduler was down past the grace window', function () {
    Notification::fake();
    reminderRule(1440);
    reminderBooking();

    runReminders(reminderStart()->subHours(24)->addMinutes(90));
    Notification::assertNothingSent();
});

it('gives a booking made 3 hours ahead only the reminders still ahead of it', function () {
    Notification::fake();
    foreach ([1440, 720, 360, 120] as $minutes) {
        reminderRule($minutes);
    }
    $start = reminderStart();
    $booking = reminderBooking(['created_at' => $start->subHours(3)]);

    foreach ([24, 12, 6] as $hours) {
        runReminders($start->subHours($hours)->addMinutes(5));
    }
    Notification::assertNothingSent();

    runReminders($start->subHours(2)->addMinutes(5));
    Notification::assertSentToTimes($booking->customer, BookingReminder::class, 1);
});

it('sends the reminders again for the new time after a reschedule', function () {
    Notification::fake();
    reminderRule(1440);
    $booking = reminderBooking();
    $start = reminderStart();

    runReminders($start->subHours(24)->addMinutes(5));
    Notification::assertSentToTimes($booking->customer, BookingReminder::class, 1);

    $newStart = $start->addDay();
    $booking->forceFill(['starts_at' => $newStart, 'ends_at' => $newStart->addMinutes(45)])->save();

    runReminders($newStart->subHours(24)->addMinutes(5));
    Notification::assertSentToTimes($booking->customer, BookingReminder::class, 2);
});

it('sends nothing for cancelled, completed or past bookings', function () {
    Notification::fake();
    reminderRule(1440);
    $start = reminderStart();
    reminderBooking(['status' => 'cancelled']);
    reminderBooking(['status' => 'completed']);
    reminderBooking(['status' => 'no_show']);

    runReminders($start->subHours(24)->addMinutes(5));
    Notification::assertNothingSent();

    $late = reminderBooking();
    runReminders($start->addHour()); // the appointment has started
    Notification::assertNotSentTo($late->customer, BookingReminder::class);
});

it('emails a guest booking at its guest email through an on-demand route', function () {
    Notification::fake();
    reminderRule(1440);
    reminderBooking(['customer_id' => null, 'guest_email' => 'guest@example.com', 'guest_name' => 'Guest']);

    runReminders(reminderStart()->subHours(24)->addMinutes(5));

    Notification::assertSentOnDemand(BookingReminder::class, fn ($notification, $channels, AnonymousNotifiable $notifiable) => $notifiable->routes['mail'] === 'guest@example.com');
});

it('skips a phone-only guest without error and without a log row', function () {
    Notification::fake();
    reminderRule(1440);
    reminderBooking(['customer_id' => null, 'guest_email' => null, 'guest_phone' => '923001234567']);

    runReminders(reminderStart()->subHours(24)->addMinutes(5));

    Notification::assertNothingSent();
    expect(NotificationLog::where('channel', 'reminder')->count())->toBe(0);
});

it('accepts reminder offsets from 30 minutes to 7 days and rejects anything outside', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create(['email_verified_at' => now()]);
    $admin->assignRole('super-admin');
    $post = fn (int $amount, string $unit) => $this->actingAs($admin)->post('/admin/reminders/rules', [
        'name' => 'r', 'event' => 'before_booking', 'amount' => $amount, 'unit' => $unit, 'is_active' => true,
    ]);

    $post(29, 'minutes')->assertSessionHasErrors('amount');
    $post(8, 'days')->assertSessionHasErrors('amount');
    $post(30, 'minutes')->assertSessionHasNoErrors();
    $post(7, 'days')->assertSessionHasNoErrors();
    $post(18, 'hours')->assertSessionHasNoErrors();
    expect(ReminderRule::pluck('offset_minutes')->sort()->values()->all())->toBe([30, 1080, 10080]);
});

it('adds the suggested 24h, 12h and 6h rules once, only when asked', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create(['email_verified_at' => now()]);
    $admin->assignRole('super-admin');
    expect(ReminderRule::count())->toBe(0);

    $this->actingAs($admin)->post('/admin/reminders/rules/suggested')->assertRedirect();
    $this->actingAs($admin)->post('/admin/reminders/rules/suggested')->assertRedirect();

    expect(ReminderRule::where('event', 'before_booking')->where('is_active', true)->pluck('offset_minutes')->sort()->values()->all())->toBe([360, 720, 1440]);
});

it('renders the reminder email with the lead time, details, policy text and the right buttons', function () {
    \App\Models\Setting::create(['key' => 'booking.cancel_policy_text', 'value' => 'Message us before you cancel.', 'group' => 'booking']);
    $booking = reminderBooking(['status' => 'pending', 'starts_at' => now()->addDays(3)->setTime(13, 0), 'ends_at' => now()->addDays(3)->setTime(13, 45)]);

    $html = (string) (new BookingReminder($booking, ['email'], 1440))->toMail($booking->customer)->render();

    expect($html)->toContain('in 24 hours')->toContain($booking->code)->toContain('Confirm my booking')
        ->toContain('Reschedule')->toContain('Cancel booking')->toContain('Message us before you cancel.')
        ->toContain('/b/' . $booking->code)->toContain('Total:');

    $booking->forceFill(['status' => 'confirmed'])->save();
    $html = (string) (new BookingReminder($booking->fresh(), ['email'], 360))->toMail($booking->customer)->render();
    expect($html)->not->toContain('Confirm my booking')->toContain('in 6 hours')->toContain('Reschedule');
});

it('renders the reminder for a guest without an unsubscribe link and with mail as the only channel', function () {
    $booking = reminderBooking(['customer_id' => null, 'guest_email' => 'guest@example.com', 'guest_name' => 'Guest', 'starts_at' => now()->addDays(3)]);
    $notifiable = (new AnonymousNotifiable)->route('mail', 'guest@example.com');
    $notification = new BookingReminder($booking, ['email'], 720);

    expect($notification->via($notifiable))->toBe([\App\Channels\MailChannel::class]);
    $html = (string) $notification->toMail($notifiable)->render();
    expect($html)->toContain('Hi Guest')->toContain('in 12 hours')->not->toContain('Unsubscribe');
});

it('cancels from the signed page only on POST, once, and records it', function () {
    Notification::fake();
    $booking = reminderBooking(['status' => 'confirmed', 'starts_at' => now()->addDays(5), 'ends_at' => now()->addDays(5)->addMinutes(45)]);
    $page = \App\Http\Controllers\BookingLinkController::url($booking);
    $cancelUrl = \App\Http\Controllers\BookingLinkController::url($booking, 'booking.link.cancel');

    $this->get($page)->assertOk()->assertInertia(fn ($p) => $p->where('booking.can_cancel', true)->has('cancelPolicy')->has('urls.cancel'));
    expect($this->get($cancelUrl)->status())->toBeIn([404, 405]); // GET never cancels
    expect($booking->fresh()->status)->toBe('confirmed');

    $this->postJson(route('booking.link.cancel', $booking->code))->assertForbidden();
    expect($booking->fresh()->status)->toBe('confirmed');

    $this->postJson($cancelUrl)->assertOk()->assertJson(['status' => 'cancelled']);
    expect($booking->fresh()->status)->toBe('cancelled');
    expect(\App\Models\BookingStatusLog::where('booking_id', $booking->id)->where('reason', 'Cancelled by customer (email link)')->count())->toBe(1);

    $this->postJson($cancelUrl)->assertStatus(422);
    expect(\App\Models\BookingStatusLog::where('booking_id', $booking->id)->where('to_status', 'cancelled')->count())->toBe(1);
});

it('emails a guest their cancellation through the on-demand route', function () {
    Notification::fake();
    $booking = reminderBooking(['customer_id' => null, 'guest_email' => 'guest@example.com', 'status' => 'pending', 'starts_at' => now()->addDays(5), 'ends_at' => now()->addDays(5)->addMinutes(45)]);

    $this->postJson(\App\Http\Controllers\BookingLinkController::url($booking, 'booking.link.cancel'))->assertOk();

    Notification::assertSentOnDemand(\App\Notifications\BookingCancelled::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === 'guest@example.com');
});

function reminderAdmin(): User
{
    test()->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create(['email_verified_at' => now()]);
    $admin->assignRole('super-admin');

    return $admin;
}

it('previews the next reminders, including a guest with only an email and a booking with no email', function () {
    reminderRule(1440);
    $start = now()->addDays(3)->setTime(15, 0);
    $account = reminderBooking(['starts_at' => $start, 'ends_at' => $start->copy()->addHour(), 'created_at' => now()->subDay()]);
    $guest = reminderBooking(['customer_id' => null, 'guest_email' => 'guest@example.com', 'guest_name' => 'Guesty', 'starts_at' => $start->copy()->addHour(), 'ends_at' => $start->copy()->addHours(2), 'created_at' => now()->subDay()]);
    $phoneOnly = reminderBooking(['customer_id' => null, 'guest_email' => null, 'guest_name' => 'Phone Only', 'starts_at' => $start->copy()->addHours(2), 'ends_at' => $start->copy()->addHours(3), 'created_at' => now()->subDay()]);

    $rows = collect($this->actingAs(reminderAdmin())->get('/admin/reminders')->viewData('page')['props']['upcomingReminders'])->keyBy('ref');

    expect($rows)->toHaveCount(3)
        ->and($rows[$account->code]['email'])->toBe($account->customer->email)
        ->and($rows[$guest->code]['email'])->toBe('guest@example.com')
        ->and($rows[$phoneOnly->code]['email'])->toBeNull()
        ->and($rows[$guest->code]['send_at'])->toBe(\Carbon\CarbonImmutable::parse($guest->starts_at)->subDay()->setTimezone('Asia/Karachi')->format('D j M, g:i A'));
});

it('sends a test reminder only to the logged-in admin, with sample data when there is no upcoming booking', function () {
    Notification::fake();
    $admin = reminderAdmin();

    $this->actingAs($admin)->post('/admin/reminders/test-email')->assertRedirect()->assertSessionHas('success');

    Notification::assertSentOnDemand(BookingReminder::class, fn ($n, $channels, $notifiable) => $notifiable->routes['mail'] === $admin->email);
    Notification::assertSentOnDemandTimes(BookingReminder::class, 1);
    expect(\App\Models\Booking::count())->toBe(0);
});

it('does not let non-admins preview or send test reminders', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');

    $this->actingAs($customer)->post('/admin/reminders/test-email')->assertForbidden();
});
