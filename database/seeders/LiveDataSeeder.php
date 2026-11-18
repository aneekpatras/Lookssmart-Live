<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\File;
use Illuminate\Support\Facades\Schema;

/**
 * Loads a snapshot of the live site's content (catalog, deals, blog, real Google reviews,
 * gallery, settings, business hours). Replaces those tables' rows.
 * Does NOT touch users, bookings, staff, sessions or any other operational data.
 *
 * Run: php artisan db:seed --class=LiveDataSeeder
 */
class LiveDataSeeder extends Seeder
{
    public function run(): void
    {
        $sql = File::get(database_path('seeders/data/live_data.sql'));

        Schema::disableForeignKeyConstraints();
        try {
            DB::unprepared($sql);
        } finally {
            Schema::enableForeignKeyConstraints();
        }

        cache()->flush();
    }
}
