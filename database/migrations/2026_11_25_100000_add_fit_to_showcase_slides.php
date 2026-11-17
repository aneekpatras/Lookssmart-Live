<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/** How a showcase slide image fills the arch: 'cover' (fill the frame) or 'contain' (show the whole image). */
return new class extends Migration
{
    public function up(): void
    {
        if (! Schema::hasTable('showcase_slides') || Schema::hasColumn('showcase_slides', 'fit')) {
            return;
        }

        Schema::table('showcase_slides', function (Blueprint $table) {
            $table->string('fit', 10)->default('cover')->after('focus');
        });
    }

    public function down(): void
    {
        if (Schema::hasTable('showcase_slides') && Schema::hasColumn('showcase_slides', 'fit')) {
            Schema::table('showcase_slides', function (Blueprint $table) {
                $table->dropColumn('fit');
            });
        }
    }
};
