<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** Optional link from a gallery photo to a service or a deal ("Book this look" adds it to the cart). */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('gallery_images', function (Blueprint $table) {
            if (! Schema::hasColumn('gallery_images', 'linked_type')) {
                $table->string('linked_type', 20)->nullable();
            }
            if (! Schema::hasColumn('gallery_images', 'linked_id')) {
                $table->unsignedBigInteger('linked_id')->nullable();
            }
        });
    }

    public function down(): void
    {
        Schema::table('gallery_images', function (Blueprint $table) {
            $table->dropColumn(['linked_type', 'linked_id']);
        });
    }
};
