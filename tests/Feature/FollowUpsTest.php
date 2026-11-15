<?php

use App\Models\ContactDraft;
use App\Models\IncompleteBooking;
use App\Models\User;
use App\Models\VisitorSession;
use App\Support\FollowUps;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

const FU_SID = 'fu0123456789abcdef0123456789abcd';
const FU_UA = 'Mozilla/5.0 (Linux; Android 13; SM-S918B) AppleWebKit/537.36 Chrome/115.0 Mobile Safari/537.36';

function followUpsAdmin(): User
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

it('creates a visitor session once with device, source and cart, then links identity from a booking draft', function () {
    $this->withHeader('User-Agent', FU_UA)->postJson('/track', [
        'session_id' => FU_SID, 'event' => 'session_start', 'path' => '/services', 'screen' => '390x844',
        'language' => 'en-GB', 'timezone' => 'Asia/Karachi', 'referrer_host' => 'l.instagram.com',
    ])->assertNoContent();
    $this->postJson('/track', ['session_id' => FU_SID, 'event' => 'cart_update', 'cart' => [
        'items' => [['id' => 1, 'name' => 'Facial', 'type' => 'service', 'price' => 3000]], 'total' => 3000,
    ]])->assertNoContent();
    $this->postJson('/track', ['session_id' => FU_SID, 'event' => 'page_view', 'path' => '/book'])->assertNoContent();

    $session = VisitorSession::where('session_id', FU_SID)->first();
    expect($session->device_type)->toBe('mobile')
        ->and($session->browser)->toBe('Chrome')
        ->and($session->source)->toBe('Instagram')
        ->and($session->screen)->toBe('390x844')
        ->and($session->cart[0]['name'])->toBe('Facial')
        ->and((float) $session->cart_total)->toBe(3000.0)
        ->and($session->pages_count)->toBe(1)
        ->and($session->phone)->toBeNull();

    $this->postJson('/track/incomplete', [
        'session_id' => FU_SID, 'name' => 'Ayesha', 'phone' => '0300 1234567',
        'items' => [['id' => 1, 'name' => 'Facial', 'price' => 3000]], 'total' => 3000,
    ])->assertNoContent();

    expect($session->fresh()->phone)->toBe('923001234567')->and($session->fresh()->name)->toBe('Ayesha');

    // an empty cart clears the snapshot
    $this->postJson('/track', ['session_id' => FU_SID, 'event' => 'cart_update', 'cart' => ['items' => [], 'total' => 0]])->assertNoContent();
    expect($session->fresh()->cart)->toBeNull();
});

it('keeps at most 25 page views per session per day', function () {
    foreach (range(1, 30) as $i) {
        $this->postJson('/track', ['session_id' => FU_SID, 'event' => 'page_view', 'path' => "/p{$i}"]);
    }

    expect(VisitorSession::first()->pages_count)->toBe(25);
});

it('saves a contact draft, then marks it sent on the real submit', function () {
    $this->seed(RolesAndPermissionsSeeder::class);

    $this->postJson('/track/contact', [
        'session_id' => FU_SID, 'name' => 'Sana', 'phone' => '03001234567', 'subject' => 'Bridal',
        'message' => 'Do you have a slot on Friday?',
    ])->assertNoContent();
    $this->postJson('/track/contact', [
        'session_id' => FU_SID, 'name' => 'Sana', 'phone' => '03001234567', 'message' => 'Do you have a slot on Friday for two people?',
    ])->assertNoContent();

    expect(ContactDraft::count())->toBe(1)
        ->and(ContactDraft::first()->message)->toContain('for two people')
        ->and(ContactDraft::first()->phone)->toBe('923001234567');

    // an invalid phone, or a filled honeypot, saves nothing
    $this->postJson('/track/contact', ['session_id' => 'other0123456789abcdef', 'name' => 'X', 'phone' => '123'])->assertStatus(422);
    $this->postJson('/track/contact', ['session_id' => 'bot00123456789abcdef', 'name' => 'Bot', 'phone' => '03001234567', 'website' => 'x'])->assertNoContent();
    expect(ContactDraft::count())->toBe(1);

    $this->post('/contact', [
        'name' => 'Sana', 'phone' => '03001234567', 'message' => 'Do you have a slot on Friday for two people?',
        'rendered_at' => time() - 30, 'session_id' => FU_SID,
    ]);

    expect(ContactDraft::first()->status)->toBe('sent');
});

it('closes matching follow-ups when a booking is made with that phone', function () {
    IncompleteBooking::create(['session_id' => 'a0123456789abcdef', 'name' => 'A', 'phone' => '923001234567', 'status' => 'new', 'last_seen_at' => now()]);
    ContactDraft::create(['session_id' => 'b0123456789abcdef', 'name' => 'A', 'phone' => '923001234567', 'status' => 'new', 'last_seen_at' => now()]);
    VisitorSession::create(['session_id' => 'c0123456789abcdef', 'phone' => '923001234567', 'status' => 'new', 'last_seen_at' => now()]);
    VisitorSession::create(['session_id' => 'd0123456789abcdef', 'phone' => '923111111111', 'status' => 'new', 'last_seen_at' => now()]);

    FollowUps::markBooked('03001234567');

    expect(IncompleteBooking::first()->status)->toBe('converted')
        ->and(ContactDraft::first()->status)->toBe('booked')
        ->and(VisitorSession::where('session_id', 'c0123456789abcdef')->first()->status)->toBe('booked')
        ->and(VisitorSession::where('session_id', 'd0123456789abcdef')->first()->status)->toBe('new');
});

it('shows the right rows on each Follow-ups tab and hides bots', function () {
    $admin = followUpsAdmin();
    $old = now()->subHour();

    IncompleteBooking::create(['session_id' => 'ib0123456789abcdef', 'name' => 'Real', 'phone' => '923001234567', 'status' => 'new', 'last_seen_at' => now()]);
    IncompleteBooking::create(['session_id' => 'ib1123456789abcdef', 'name' => 'BotUser', 'phone' => '923001111111', 'status' => 'new', 'last_seen_at' => now()]);
    VisitorSession::create(['session_id' => 'ib1123456789abcdef', 'is_bot' => true, 'status' => 'new', 'last_seen_at' => now()]);

    ContactDraft::create(['session_id' => 'cd0123456789abcdef', 'name' => 'Sana', 'phone' => '923001234567', 'message' => 'Hello there', 'status' => 'new', 'last_seen_at' => now()]);
    ContactDraft::create(['session_id' => 'cd1123456789abcdef', 'name' => 'Done', 'phone' => '923002222222', 'message' => 'Sent', 'status' => 'sent', 'last_seen_at' => now()]);

    $cart = [['id' => 1, 'name' => 'Facial', 'type' => 'service', 'price' => 3000]];
    VisitorSession::create(['session_id' => 'cart0123456789abcdef', 'phone' => '923003333333', 'name' => 'Abandoner', 'cart' => $cart, 'cart_total' => 3000, 'cart_updated_at' => $old, 'status' => 'new', 'last_seen_at' => $old]);
    VisitorSession::create(['session_id' => 'cart1123456789abcdef', 'phone' => '923004444444', 'cart' => $cart, 'cart_total' => 3000, 'cart_updated_at' => now(), 'status' => 'new', 'last_seen_at' => now()]); // too recent
    VisitorSession::create(['session_id' => 'anon0123456789abcdef', 'cart' => $cart, 'cart_total' => 3000, 'cart_updated_at' => $old, 'status' => 'new', 'last_seen_at' => $old]);
    VisitorSession::create(['session_id' => 'anon1123456789abcdef', 'cart' => $cart, 'is_bot' => true, 'cart_updated_at' => $old, 'status' => 'new', 'last_seen_at' => $old]);

    $get = fn (string $query) => $this->actingAs($admin)->get('/admin/follow-ups?' . $query);

    $get('tab=bookings')->assertInertia(fn ($p) => $p->component('Admin/FollowUps')
        ->has('rows', 1)->where('rows.0.name', 'Real')->where('rows.0.phone', '+92 300 1234567')->where('hiddenBots', 2));
    $get('tab=bookings&bots=1')->assertInertia(fn ($p) => $p->has('rows', 2)->where('hiddenBots', 0));
    $get('tab=contacts')->assertInertia(fn ($p) => $p->has('rows', 1)->where('rows.0.name', 'Sana'));
    $get('tab=carts')->assertInertia(fn ($p) => $p->has('rows', 1)->where('rows.0.name', 'Abandoner')->where('rows.0.can_contact', true));
    $get('tab=visitors')->assertInertia(fn ($p) => $p->has('rows', 1)->where('rows.0.phone', null)->where('rows.0.can_contact', false));
});

it('updates a follow-up status and serves the journey only to admins', function () {
    $admin = followUpsAdmin();
    $row = IncompleteBooking::create(['session_id' => 'st0123456789abcdef', 'name' => 'A', 'phone' => '923001234567', 'status' => 'new', 'last_seen_at' => now()]);

    $this->actingAs($admin)->patch("/admin/follow-ups/booking/{$row->id}/status", ['status' => 'booked'])->assertRedirect();
    expect($row->fresh()->status)->toBe('converted');

    $this->actingAs($admin)->postJson("/admin/follow-ups/booking/{$row->id}/contacted", ['phone' => '923001234567', 'message' => 'hi'])->assertNoContent();
    $this->actingAs($admin)->getJson('/admin/follow-ups/journey?session_id=st0123456789abcdef')->assertOk()->assertJsonStructure(['session', 'events', 'pages']);

    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');
    $this->actingAs($customer)->getJson('/admin/follow-ups/journey?session_id=st0123456789abcdef')->assertForbidden();
});
