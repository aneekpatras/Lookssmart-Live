<?php

use App\Models\User;
use App\Support\PasswordPolicy;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Validator;

uses(RefreshDatabase::class);

function passwordErrors(?User $user, string $password, bool $newCustomer = false): array
{
    return Validator::make(
        ['password' => $password, 'password_confirmation' => $password],
        ['password' => PasswordPolicy::rulesFor($user, $newCustomer)],
    )->errors()->get('password');
}

it('accepts a customer password of 8 characters with an uppercase letter and a number', function () {
    expect(passwordErrors(null, 'Lahore99x', true))->toBe([]);
    expect(passwordErrors(null, 'Salon2026', true))->toBe([]);
});

it('rejects short, no-uppercase, no-number and very common customer passwords', function () {
    expect(passwordErrors(null, 'Ab1', true))->not->toBe([])
        ->and(passwordErrors(null, 'lowercase1', true))->not->toBe([])
        ->and(passwordErrors(null, 'NoNumberHere', true))->not->toBe([])
        ->and(passwordErrors(null, 'Password1', true))->not->toBe([])
        ->and(passwordErrors(null, 'QWERTY123', true))->not->toBe([]);
});

it('keeps the 12 character rule for admin and staff accounts', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create();
    $admin->assignRole('admin');
    $customer = User::factory()->create();
    $customer->assignRole('customer');

    expect(PasswordPolicy::isStaff($admin->fresh()))->toBeTrue()
        ->and(PasswordPolicy::isStaff($customer->fresh()))->toBeFalse()
        ->and(passwordErrors($admin->fresh(), 'Lahore99x'))->not->toBe([])
        ->and(passwordErrors($customer->fresh(), 'Lahore99x'))->toBe([]);
});

it('shares the same constants with the front-end checklist', function () {
    expect(PasswordPolicy::forFrontend())->toBe(['min' => 8, 'uppercase' => true, 'number' => true]);
});
