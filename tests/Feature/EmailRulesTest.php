<?php

use App\Models\ReminderRule;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

function emailRulesAdmin(): User
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

it('starts with no rules and shows the scheduler and mail status', function () {
    $this->actingAs(emailRulesAdmin())->get('/admin/reminders')
        ->assertOk()
        ->assertInertia(fn ($page) => $page
            ->where('emailRules', [])
            ->where('scheduler.last_run', null)
            ->where('mail.queue', config('queue.default'))
            ->where('mail.mailer', config('mail.default')));
    expect(ReminderRule::count())->toBe(0);

    Cache::forever('scheduler.heartbeat', now()->toIso8601String());
    $this->actingAs(emailRulesAdmin())->get('/admin/reminders')
        ->assertInertia(fn ($page) => $page->whereNot('scheduler.last_run', null));
});

it('creates, updates and deletes an email rule using the offset the commands read', function () {
    $admin = emailRulesAdmin();

    $this->actingAs($admin)->post('/admin/reminders/rules', [
        'name' => 'Day before', 'event' => 'before_booking', 'amount' => 1, 'unit' => 'days', 'is_active' => true,
    ])->assertRedirect();

    $rule = ReminderRule::firstOrFail();
    expect($rule->event)->toBe('before_booking')
        ->and($rule->direction)->toBe('before')
        ->and($rule->offset_minutes)->toBe(1440)
        ->and($rule->channels)->toBe(['email'])
        ->and($rule->template)->toBe('Day before')
        ->and($rule->is_active)->toBeTrue();

    $this->actingAs($admin)->put("/admin/reminders/rules/{$rule->id}", [
        'name' => 'Thanks', 'event' => 'review_request', 'amount' => 3, 'unit' => 'hours', 'is_active' => false,
    ])->assertRedirect();

    $rule->refresh();
    expect($rule->event)->toBe('review_request')
        ->and($rule->direction)->toBe('after')
        ->and($rule->offset_minutes)->toBe(180)
        ->and($rule->is_active)->toBeFalse();

    $this->actingAs($admin)->delete("/admin/reminders/rules/{$rule->id}")->assertRedirect();
    expect(ReminderRule::count())->toBe(0);
});

it('rejects offsets the scheduled commands would never send and bad input', function () {
    $admin = emailRulesAdmin();

    $this->actingAs($admin)->post('/admin/reminders/rules', [
        'name' => 'Odd', 'event' => 'before_booking', 'amount' => 5, 'unit' => 'hours', 'is_active' => true,
    ])->assertSessionHasErrors('amount');

    $this->actingAs($admin)->post('/admin/reminders/rules', [
        'name' => '', 'event' => 'birthday', 'amount' => 0, 'unit' => 'weeks', 'is_active' => true,
    ])->assertSessionHasErrors(['name', 'event', 'amount', 'unit']);

    expect(ReminderRule::count())->toBe(0);
});

it('only lets people who can manage settings change email rules', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');

    $this->actingAs($customer)->post('/admin/reminders/rules', [
        'name' => 'X', 'event' => 'before_booking', 'amount' => 2, 'unit' => 'hours', 'is_active' => true,
    ])->assertForbidden();
    expect(ReminderRule::count())->toBe(0);
});
