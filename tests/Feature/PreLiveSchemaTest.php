<?php

use App\Models\User;
use Illuminate\Foundation\Testing\RefreshDatabase;
use Illuminate\Support\Facades\Schema;
use Spatie\Permission\Models\Role;

uses(RefreshDatabase::class);

/**
 * Live runs this code before (or without) the newest database changes. Every public page must still
 * render when those tables/columns are missing; only admin pages may show their "run the SQL" notice.
 */
it('renders the public site when the newer tables and columns do not exist', function () {
    Schema::disableForeignKeyConstraints();
    foreach (['faqs', 'faq_categories', 'site_events', 'incomplete_bookings', 'security_events', 'visitor_sessions', 'contact_drafts', 'manual_message_logs'] as $table) {
        Schema::dropIfExists($table);
    }
    Schema::enableForeignKeyConstraints();

    foreach (['specialty', 'linked_type', 'linked_id'] as $column) {
        if (Schema::hasColumn('gallery_images', $column)) {
            Schema::table('gallery_images', fn ($t) => $t->dropColumn($column));
        }
    }

    // users.phone and its unique index. users.email stays NOT NULL here, which matches live.
    if (Schema::hasColumn('users', 'phone')) {
        Schema::table('users', function ($t) {
            $t->dropUnique(['phone']);
        });
        Schema::table('users', fn ($t) => $t->dropColumn('phone'));
    }

    foreach (['/', '/faqs', '/services', '/deals', '/gallery', '/blog', '/contact', '/book', '/login', '/register', '/about', '/sitemap.xml'] as $url) {
        $this->get($url)->assertOk();
    }
    $this->get('/this-page-does-not-exist')->assertNotFound();

    // Register by email, then log in by email and by a phone number: none of it may be a 500.
    Role::findOrCreate('customer', 'web');
    $this->post('/register', [
        'name' => 'Test Customer',
        'email' => 'new@example.com',
        'phone' => '03001234567',
        'password' => 'Str0ng!Passw0rd#2026',
        'password_confirmation' => 'Str0ng!Passw0rd#2026',
    ])->assertRedirect();
    expect(User::where('email', 'new@example.com')->exists())->toBeTrue();
    auth()->logout();
    expect($this->post('/login', ['email' => '03001234567', 'password' => 'x'])->status())->toBeLessThan(500);
    expect($this->post('/login', ['email' => 'new@example.com', 'password' => 'Str0ng!Passw0rd#2026'])->status())->toBeLessThan(500);

    foreach (['/track', '/track/incomplete', '/track/contact'] as $url) {
        $status = $this->postJson($url, ['session_id' => 'abcdefgh12345678', 'event' => 'session_start', 'path' => '/'])->status();
        expect($status)->toBeLessThan(500);
    }
});
