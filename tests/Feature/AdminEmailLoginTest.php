<?php

use App\Models\AdminLoginChallenge;
use App\Models\User;
use Database\Seeders\RolesAndPermissionsSeeder;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Schema;

uses(RefreshDatabase::class);

const ADMIN_PASSWORD = 'Str0ng!Passw0rd#1';

beforeEach(function () {
    config(['auth.admin_email_2fa' => true]);
    $this->seed(RolesAndPermissionsSeeder::class);
});

function emailAdmin(): User
{
    $user = User::factory()->create(['email' => 'boss@example.test', 'password' => Hash::make(ADMIN_PASSWORD), 'email_verified_at' => now()]);
    $user->assignRole('admin');

    return $user;
}

function emailCustomer(): User
{
    $user = User::factory()->create(['email' => 'client@example.test', 'password' => Hash::make(ADMIN_PASSWORD), 'email_verified_at' => now()]);
    $user->assignRole('customer');

    return $user;
}

function loginAs(string $email)
{
    return test()->post('/login', ['email' => $email, 'password' => ADMIN_PASSWORD]);
}

/** @return array{code: string, url: string, subject: string, to: string, body: string} The newest email that was sent. */
function lastSignInMail(): array
{
    $message = app('mailer')->getSymfonyTransport()->messages()->last()->getOriginalMessage();
    $html = html_entity_decode((string) $message->getHtmlBody());
    preg_match('#<strong[^>]*>(\d{6})</strong>#', $html, $code);
    preg_match('#href="([^"]*admin-verify/approve[^"]*)"#', $html, $url);

    return ['code' => $code[1] ?? '', 'url' => $url[1] ?? '', 'subject' => $message->getSubject(), 'to' => $message->getTo()[0]->getAddress(), 'body' => $html];
}

it('leaves customer login unchanged', function () {
    loginAs(emailCustomer()->email)->assertRedirect('/my-account');

    expect(Auth::check())->toBeTrue();
    expect(AdminLoginChallenge::count())->toBe(0);
});

it('does not log an admin in after the password: it emails a code and waits', function () {
    $admin = emailAdmin();

    loginAs($admin->email)->assertRedirect('/admin-verify');

    expect(Auth::check())->toBeFalse();
    $mail = lastSignInMail();
    expect($mail['subject'])->toBe('Your Looks Smart admin sign-in code')
        ->and($mail['to'])->toBe($admin->email)
        ->and($mail['code'])->toMatch('/^\d{6}$/')
        ->and($mail['url'])->toContain('/admin-verify/approve/')
        ->and($mail['body'])->toContain('If this was not you, change your password');

    $row = AdminLoginChallenge::first();
    // Only hashes are stored, never the code or the link token.
    expect($row->code_hash)->not->toBe($mail['code'])->and(strlen($row->code_hash))->toBe(64)
        ->and($row->token_hash)->not->toContain(basename(parse_url($mail['url'], PHP_URL_PATH)));
    $this->get('/admin-verify')->assertOk();
});

it('logs the admin in with the correct code, once', function () {
    $admin = emailAdmin();
    loginAs($admin->email);
    $code = lastSignInMail()['code'];

    $this->post('/admin-verify', ['code' => $code])->assertRedirect('/admin');

    expect(Auth::id())->toBe($admin->id);
    expect(AdminLoginChallenge::first()->used_at)->not->toBeNull();

    // The same code cannot be used again, in this or another session.
    auth()->logout();
    $this->flushSession();
    $this->post('/admin-verify', ['code' => $code])->assertRedirect('/login');
    expect(Auth::check())->toBeFalse();
});

it('rejects a wrong code, counts attempts and ends the challenge after five', function () {
    loginAs(emailAdmin()->email);
    $code = lastSignInMail()['code'];
    $wrong = $code === '000000' ? '111111' : '000000';

    $this->post('/admin-verify', ['code' => $wrong])->assertSessionHasErrors('code');
    expect(AdminLoginChallenge::first()->attempts)->toBe(1);

    foreach (range(1, 4) as $i) {
        $this->post('/admin-verify', ['code' => $wrong]);
    }

    // Five wrong codes: even the right one no longer works.
    $this->post('/admin-verify', ['code' => $code])->assertRedirect('/login');
    expect(Auth::check())->toBeFalse();
});

it('rejects an expired code', function () {
    loginAs(emailAdmin()->email);
    $code = lastSignInMail()['code'];

    $this->travel(11)->minutes();
    $this->post('/admin-verify', ['code' => $code])->assertRedirect('/login');

    expect(Auth::check())->toBeFalse();
});

it('validates the code format', function () {
    loginAs(emailAdmin()->email);

    $this->post('/admin-verify', ['code' => 'abc'])->assertSessionHasErrors('code');
    $this->post('/admin-verify', ['code' => ''])->assertSessionHasErrors('code');
});

it('resends a code only after the cooldown', function () {
    loginAs(emailAdmin()->email);
    $first = lastSignInMail()['code'];

    $this->post('/admin-verify/resend')->assertSessionHasErrors('code');
    expect(AdminLoginChallenge::count())->toBe(1);

    $this->travel(61)->seconds();
    $this->post('/admin-verify/resend')->assertSessionHasNoErrors();
    expect(AdminLoginChallenge::count())->toBe(2);

    // The new code works; the replaced one does not.
    $second = lastSignInMail()['code'];
    if ($second !== $first) {
        $this->post('/admin-verify', ['code' => $first])->assertSessionHasErrors('code');
    }
    $this->post('/admin-verify', ['code' => $second])->assertRedirect('/admin');
});

it('stops resending after five sends in an hour', function () {
    loginAs(emailAdmin()->email);

    foreach (range(1, 4) as $i) {
        $this->travel(61)->seconds();
        $this->post('/admin-verify/resend')->assertSessionHasNoErrors();
    }
    $this->travel(61)->seconds();
    $this->post('/admin-verify/resend')->assertSessionHasErrors('code');
    expect(AdminLoginChallenge::count())->toBe(5);
});

it('approves through the emailed link only in the same browser session', function () {
    $admin = emailAdmin();
    loginAs($admin->email);
    $url = lastSignInMail()['url'];

    // Another browser (a fresh session): nothing happens.
    $this->flushSession();
    $this->get($url)->assertOk()->assertInertia(fn ($page) => $page->component('Auth/AdminVerify')->where('wrongBrowser', true));
    expect(Auth::check())->toBeFalse()->and(AdminLoginChallenge::first()->used_at)->toBeNull();

    // The same browser: the sign-in is approved.
    $this->flushSession();
    loginAs($admin->email);
    $this->get(lastSignInMail()['url'])->assertRedirect('/admin');
    expect(Auth::id())->toBe($admin->id);
});

it('rejects a tampered approve link', function () {
    loginAs(emailAdmin()->email);

    $this->get(lastSignInMail()['url'] . 'x')->assertForbidden();
    expect(Auth::check())->toBeFalse();
});

it('skips the step when the emergency switch is off', function () {
    config(['auth.admin_email_2fa' => false]);

    loginAs(emailAdmin()->email)->assertRedirect('/admin');

    expect(Auth::check())->toBeTrue();
    expect(AdminLoginChallenge::count())->toBe(0);
});

it('behaves as off when the challenges table is missing', function () {
    Schema::drop('admin_login_challenges');

    loginAs(emailAdmin()->email)->assertRedirect('/admin');

    expect(Auth::check())->toBeTrue();
});

it('does not log in and says so when the email cannot be sent', function () {
    config(['mail.default' => 'smtp', 'mail.mailers.smtp.host' => '127.0.0.1', 'mail.mailers.smtp.port' => 1, 'mail.mailers.smtp.timeout' => 2]);
    app('mail.manager')->purge('smtp');

    loginAs(emailAdmin()->email)->assertSessionHasErrors('email');

    expect(Auth::check())->toBeFalse();
    expect(AdminLoginChallenge::count())->toBe(0);
});

it('keeps a wrong password as a plain login failure for admins', function () {
    $admin = emailAdmin();

    $this->post('/login', ['email' => $admin->email, 'password' => 'not-the-password'])->assertSessionHasErrors('email');

    expect(AdminLoginChallenge::count())->toBe(0);
});

it('sends a test email to the signed-in admin from Settings', function () {
    config(['auth.admin_email_2fa' => false]);
    $admin = User::factory()->create(['email' => 'owner@example.test', 'email_verified_at' => now(), 'two_factor_secret' => encrypt('s'), 'two_factor_confirmed_at' => now()]);
    $admin->assignRole('super-admin');

    $this->actingAs($admin)->post('/admin/settings/test-email')->assertSessionHas('success');

    $message = app('mailer')->getSymfonyTransport()->messages()->last()->getOriginalMessage();
    expect($message->getTo()[0]->getAddress())->toBe('owner@example.test')->and($message->getSubject())->toBe('Looks Smart test email');
});

it('shows the sign-in codes note and the test email button in the SEO and Security settings tab', function () {
    $source = file_get_contents(resource_path('js/Pages/Admin/CMS/Settings/Index.tsx'));

    expect($source)->toContain('Admin sign-in codes are sent to the admin')->toContain('Send test email')->toContain('/admin/settings/test-email');
    expect(file_get_contents(resource_path('js/Pages/Public/PrivacyPolicy.tsx')))->not->toContain('sign-in code');
});
