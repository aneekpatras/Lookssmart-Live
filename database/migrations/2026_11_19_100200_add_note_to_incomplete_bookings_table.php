<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasTable('incomplete_bookings') && ! Schema::hasColumn('incomplete_bookings', 'note')) {
            Schema::table('incomplete_bookings', function (Blueprint $table) {
                $table->text('note')->nullable()->after('status');
            });
        }
    }

    public function down(): void
    {
        if (Schema::hasColumn('incomplete_bookings', 'note')) {
            Schema::table('incomplete_bookings', function (Blueprint $table) {
                $table->dropColumn('note');
            });
        }
    }
};
