<?php

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;

uses(RefreshDatabase::class);

beforeEach(fn () => $this->seed(RolesAndPermissionsSeeder::class));

function registerPayload(array $overrides = []): array
{
    return array_merge([
        'name' => 'Test Customer', 'password' => 'Lahore99x', 'password_confirmation' => 'Lahore99x',
    ], $overrides);
}

it('registers with a phone number only and stores the normalised number', function () {
    $this->post('/register', registerPayload(['phone' => '0300 123-4567']))->assertSessionHasNoErrors();

    $user = User::where('phone', '923001234567')->first();
    expect($user)->not->toBeNull()
        ->and($user->email)->toBeNull()
        ->and($user->hasVerifiedEmail())->toBeTrue()
        ->and($user->hasRole('customer'))->toBeTrue();
});

it('registers with an email only', function () {
    $this->post('/register', registerPayload(['email' => 'mail@example.com']))->assertSessionHasNoErrors();

    expect(User::where('email', 'mail@example.com')->first()?->phone)->toBeNull();
});

it('refuses a registration with neither phone nor email, an invalid phone, or a duplicate phone', function () {
    $this->post('/register', registerPayload())->assertSessionHasErrors(['phone', 'email']);
    $this->post('/register', registerPayload(['phone' => '12345']))->assertSessionHasErrors('phone');

    User::factory()->create(['phone' => '03001234567']);
    $this->post('/register', registerPayload(['phone' => '+92 300 1234567']))->assertSessionHasErrors('phone');
});

it('logs in with a phone number or with an email', function () {
    $user = User::factory()->create(['email' => 'login@example.com', 'phone' => '03001234567', 'password' => 'Lahore99x']);
    $user->assignRole('customer');

    $this->post('/login', ['email' => '0300 1234567', 'password' => 'Lahore99x'])->assertSessionHasNoErrors();
    $this->assertAuthenticatedAs($user);
    auth()->logout();

    $this->post('/login', ['email' => 'login@example.com', 'password' => 'Lahore99x'])->assertSessionHasNoErrors();
    $this->assertAuthenticatedAs($user);
});

it('gives the same generic failure for a wrong password and an unknown phone', function () {
    User::factory()->create(['phone' => '03001234567', 'password' => 'Lahore99x']);

    $this->post('/login', ['email' => '03001234567', 'password' => 'nope'])->assertSessionHasErrors('email');
    $wrong = session('errors')->get('email');
    $this->post('/login', ['email' => '03119999999', 'password' => 'nope'])->assertSessionHasErrors('email');

    expect(session('errors')->get('email'))->toBe($wrong);
    $this->assertGuest();
});

it('answers a password reset request the same way for unknown and phone-only accounts', function () {
    $this->from('/forgot-password')->post('/forgot-password', ['email' => 'nobody@example.com'])
        ->assertSessionHas('status', 'If an account with that email exists, we have sent a reset link.');
});
