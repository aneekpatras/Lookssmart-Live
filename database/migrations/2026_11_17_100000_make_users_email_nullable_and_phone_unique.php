<?php

use App\Support\Phone;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Customers can now register with a phone number only: users.email becomes nullable (it stays unique, and
 * several NULLs are allowed) and users.phone gets a unique index. Safe to re-run: every step checks the
 * current state first. Existing users keep working; they simply have no phone until they add one.
 */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasColumn('users', 'phone')) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('phone', 30)->nullable()->after('email');
            });
        }

        $email = collect(Schema::getColumns('users'))->firstWhere('name', 'email');
        if ($email && ! ($email['nullable'] ?? false)) {
            Schema::table('users', function (Blueprint $table) {
                $table->string('email')->nullable()->change();
            });
        }

        // Store phones in the one normalised format, then add the unique index only when that is safe
        // (no two users share a number); otherwise the app-level unique rule still protects new signups.
        DB::table('users')->whereNotNull('phone')->orderBy('id')->each(function ($user) {
            $normalised = Phone::normalize($user->phone);
            if ($normalised !== null && $normalised !== $user->phone) {
                DB::table('users')->where('id', $user->id)->update(['phone' => $normalised]);
            }
        });

        $hasUnique = collect(Schema::getIndexes('users'))->contains(
            fn ($index) => ($index['unique'] ?? false) && $index['columns'] === ['phone'],
        );
        $hasDuplicates = DB::table('users')->whereNotNull('phone')->select('phone')->groupBy('phone')->havingRaw('COUNT(*) > 1')->exists();

        if (! $hasUnique && ! $hasDuplicates) {
            Schema::table('users', function (Blueprint $table) {
                $table->unique('phone');
            });
        }
    }

    public function down(): void
    {
        // Left in place on purpose: turning email back to NOT NULL would fail for phone-only accounts.
    }
};
