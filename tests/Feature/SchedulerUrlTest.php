<?php

use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Cache;

uses(RefreshDatabase::class);

function schedulerAdmin(): User
{
    test()->seed(RolesAndPermissionsSeeder::class);
    $admin = User::factory()->create(['email_verified_at' => now()]);
    $admin->assignRole('super-admin');

    return $admin;
}

it('is a 404 when no token has been generated or the token is wrong', function () {
    $this->get('/scheduler/run/anything')->assertNotFound();

    $admin = schedulerAdmin();
    $this->actingAs($admin)->post('/admin/reminders/scheduler-token')->assertRedirect();
    auth()->logout();

    $this->get('/scheduler/run/not-the-token')->assertNotFound();
    expect(Cache::get('scheduler.heartbeat'))->toBeNull();
});

it('runs the scheduler and answers plain ok with the right token, and a new token kills the old one', function () {
    $admin = schedulerAdmin();
    $this->actingAs($admin)->post('/admin/reminders/scheduler-token')->assertRedirect();

    $url = $this->actingAs($admin)->get('/admin/reminders')->viewData('page')['props']['scheduler']['url'];
    expect($url)->toContain('/scheduler/run/');
    auth()->logout();

    $this->get($url)->assertOk()->assertSee('ok', false)->assertHeader('Content-Type', 'text/plain; charset=UTF-8');
    expect(Cache::get('scheduler.heartbeat'))->not->toBeNull();

    $this->actingAs($admin)->post('/admin/reminders/scheduler-token')->assertRedirect();
    auth()->logout();
    $this->get($url)->assertNotFound();
});

it('does not start a session or set cookies on the trigger URL', function () {
    $admin = schedulerAdmin();
    $this->actingAs($admin)->post('/admin/reminders/scheduler-token');
    $url = $this->actingAs($admin)->get('/admin/reminders')->viewData('page')['props']['scheduler']['url'];
    auth()->logout();

    $response = $this->get($url)->assertOk();
    expect($response->headers->getCookies())->toBeEmpty();
});

it('only lets people who can manage settings generate the token', function () {
    $this->seed(RolesAndPermissionsSeeder::class);
    $customer = User::factory()->create(['email_verified_at' => now()]);
    $customer->assignRole('customer');

    $this->actingAs($customer)->post('/admin/reminders/scheduler-token')->assertStatus(403);
});
