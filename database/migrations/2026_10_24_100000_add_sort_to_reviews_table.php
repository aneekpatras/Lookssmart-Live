<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Admin-controlled display order for the homepage reviews carousel. Lower `sort` shows first; ties
 * (every review starts at 0) fall back to newest-published-first, so a brand-new review appears at
 * the top until the admin drags it somewhere else.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->unsignedInteger('sort')->default(0)->after('published_at')->index();
        });
    }

    public function down(): void
    {
        Schema::table('reviews', function (Blueprint $table) {
            $table->dropColumn('sort');
        });
    }
};
