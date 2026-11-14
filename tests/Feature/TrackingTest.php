<?php

use App\Models\IncompleteBooking;
use App\Models\SecurityEvent;
use App\Models\SiteEvent;
use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

const SID = 'abcdef0123456789abcdef0123456789';

it('stores only whitelisted funnel events', function () {
    $this->postJson('/track', ['session_id' => SID, 'event' => 'add_to_cart', 'path' => '/services', 'meta' => ['kind' => 'service', 'id' => 5]])
        ->assertNoContent();

    expect(SiteEvent::count())->toBe(1)
        ->and(SiteEvent::first()->meta)->toBe(['kind' => 'service', 'id' => 5]);

    $this->postJson('/track', ['session_id' => SID, 'event' => 'keystroke'])->assertStatus(422);
    $this->postJson('/track', ['session_id' => 'bad id!', 'event' => 'add_to_cart'])->assertStatus(422);
    $this->postJson('/track', ['session_id' => SID, 'event' => 'add_to_cart', 'meta' => ['kind' => 'password', 'id' => 1]])->assertStatus(422);

    expect(SiteEvent::count())->toBe(1);
});

it('ignores tracking when Do Not Track is on and drops oversized payloads', function () {
    $this->withHeader('DNT', '1')->postJson('/track', ['session_id' => SID, 'event' => 'begin_booking'])->assertNoContent();
    $this->postJson('/track', ['session_id' => SID, 'event' => 'begin_booking', 'path' => str_repeat('a', 5000)])->assertNoContent();

    expect(SiteEvent::count())->toBe(0);
});

it('upserts an incomplete booking and marks it converted when the booking is submitted', function () {
    $payload = [
        'session_id' => SID,
        'name' => 'Ayesha',
        'phone' => '03001234567',
        'items' => [['id' => 1, 'name' => 'Facial', 'price' => 3000]],
        'total' => 3000,
    ];

    $this->postJson('/track/incomplete', $payload)->assertNoContent();
    $this->postJson('/track/incomplete', [...$payload, 'name' => 'Ayesha K'])->assertNoContent();

    expect(IncompleteBooking::count())->toBe(1)
        ->and(IncompleteBooking::first()->name)->toBe('Ayesha K')
        ->and(IncompleteBooking::first()->status)->toBe('new');

    $this->postJson('/track/incomplete', [...$payload, 'phone' => 'abc'])->assertStatus(422);

    $this->postJson('/track', ['session_id' => SID, 'event' => 'booking_submitted'])->assertNoContent();

    expect(IncompleteBooking::first()->status)->toBe('converted');
});

it('silently rejects a registration with the honeypot filled and logs it', function () {
    $this->post('/register', [
        'name' => 'Bot', 'email' => 'bot@example.com', 'password' => 'Lahore99x', 'password_confirmation' => 'Lahore99x',
        'website' => 'http://spam.example',
    ])->assertRedirect('/');

    expect(User::where('email', 'bot@example.com')->exists())->toBeFalse()
        ->and(SecurityEvent::where('type', 'form_spam')->count())->toBe(1);
});

it('logs a registration and masks the email in the security log', function () {
    $this->seed(\Database\Seeders\RolesAndPermissionsSeeder::class);

    $this->post('/register', [
        'name' => 'Real Person', 'email' => 'real@gmail.com', 'password' => 'Lahore99x', 'password_confirmation' => 'Lahore99x',
    ]);

    $event = SecurityEvent::where('type', 'registered')->first();
    expect($event)->not->toBeNull()
        ->and($event->subject)->toBe('r***@gmail.com');
});
