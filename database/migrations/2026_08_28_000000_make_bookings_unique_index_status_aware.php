<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * The original `UNIQUE(staff_id, starts_at)` guard (Phase 2) blocks double-BOOKING correctly, but
 * blocks forever, regardless of status — once a booking at a given slot is cancelled, the physical
 * row still occupies that (staff_id, starts_at) pair, so no one could ever book that exact slot again.
 * Found and fixed while building Phase 7 sub-step 3's cancel flow, since cancelling is meant to free
 * the slot back up (Brief §4's whole point of a "Cancellation window"). Fixed with a generated column
 * that's NULL for cancelled/no_show bookings — a unique index on it allows unlimited cancelled rows
 * for the same slot (SQL unique indexes never consider NULLs equal to each other) while still blocking
 * two simultaneously-active bookings.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Idempotent: MySQL DDL is not transactional, so a half-failed earlier run may have already
        // added/dropped some of these indexes.
        $indexes = collect(Schema::getIndexes('bookings'))->pluck('name')->all();

        Schema::table('bookings', function (Blueprint $table) use ($indexes) {
            // MariaDB/MySQL won't drop `unique(staff_id, starts_at)` while it's the only index
            // covering the `staff_id` foreign key — add a plain index first so the FK stays supported.
            if (! in_array('bookings_staff_id_index', $indexes, true)) {
                $table->index('staff_id', 'bookings_staff_id_index');
            }
            if (in_array('bookings_staff_id_starts_at_unique', $indexes, true)) {
                $table->dropUnique(['staff_id', 'starts_at']);
            }
        });

        if (DB::getDriverName() === 'sqlite') {
            // SQLite (used by the test suite) has no generated-column syntax matching MySQL/MariaDB's —
            // a partial unique index via a WHERE clause is SQLite's native equivalent and achieves the
            // exact same "cancelled/no_show rows don't collide" semantics.
            DB::statement(
                'CREATE UNIQUE INDEX bookings_active_slot_unique ON bookings (staff_id, starts_at) ' .
                "WHERE status NOT IN ('cancelled', 'no_show') AND deleted_at IS NULL",
            );

            return;
        }

        // MariaDB rejects generated columns that reference a foreign-key column (staff_id), so the
        // generated column is only a 1/NULL "is active" flag, and the unique index is composite:
        // (staff_id, starts_at, active_slot_key). NULL flags never collide, so cancelled rows are free.
        if (! Schema::hasColumn('bookings', 'active_slot_key')) {
            DB::statement(
                'ALTER TABLE bookings ADD COLUMN active_slot_key TINYINT GENERATED ALWAYS AS ' .
                "(CASE WHEN status NOT IN ('cancelled', 'no_show') AND deleted_at IS NULL " .
                'THEN 1 ELSE NULL END) STORED',
            );
        }
        DB::statement(
            'ALTER TABLE bookings ADD UNIQUE INDEX bookings_active_slot_unique (staff_id, starts_at, active_slot_key)',
        );
    }

    public function down(): void
    {
        if (DB::getDriverName() === 'sqlite') {
            DB::statement('DROP INDEX IF EXISTS bookings_active_slot_unique');
        } else {
            DB::statement('ALTER TABLE bookings DROP INDEX bookings_active_slot_unique');
            DB::statement('ALTER TABLE bookings DROP COLUMN active_slot_key');
        }

        Schema::table('bookings', function (Blueprint $table) {
            $table->unique(['staff_id', 'starts_at']);
            $table->dropIndex('bookings_staff_id_index');
        });
    }
};
