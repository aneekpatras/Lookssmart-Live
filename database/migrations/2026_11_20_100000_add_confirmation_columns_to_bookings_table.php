<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Records how a pending booking was confirmed: confirmed_at, confirmed_via (customer_email,
 * customer_account or staff) and confirmed_by (the staff user, when staff did it). Safe to re-run.
 */
return new class extends Migration
{
    public function up(): void
    {
        foreach ([
            'confirmed_at' => fn (Blueprint $t) => $t->timestamp('confirmed_at')->nullable(),
            'confirmed_via' => fn (Blueprint $t) => $t->string('confirmed_via', 20)->nullable(),
            'confirmed_by' => fn (Blueprint $t) => $t->unsignedBigInteger('confirmed_by')->nullable(),
        ] as $column => $define) {
            if (! Schema::hasColumn('bookings', $column)) {
                Schema::table('bookings', $define);
            }
        }
    }

    public function down(): void
    {
        foreach (['confirmed_by', 'confirmed_via', 'confirmed_at'] as $column) {
            if (Schema::hasColumn('bookings', $column)) {
                Schema::table('bookings', fn (Blueprint $t) => $t->dropColumn($column));
            }
        }
    }
};
