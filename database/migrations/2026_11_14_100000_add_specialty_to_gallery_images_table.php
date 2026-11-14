<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Short "specialty" line shown under a photo in the gallery lightbox (falls back to the caption). */
return new class extends Migration
{
    public function up(): void
    {
        if (Schema::hasColumn('gallery_images', 'specialty')) {
            return;
        }

        Schema::table('gallery_images', function (Blueprint $table) {
            $table->string('specialty', 160)->nullable()->after('caption');
        });
    }

    public function down(): void
    {
        Schema::table('gallery_images', function (Blueprint $table) {
            $table->dropColumn('specialty');
        });
    }
};
