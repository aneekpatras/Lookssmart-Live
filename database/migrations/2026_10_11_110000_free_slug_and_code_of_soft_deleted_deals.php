<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Soft-deleted deals kept their UNIQUE slug/code, blocking re-creation of the same deal/coupon.
 * Deal::booted() now renames them on delete; this renames the ones already deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Row-by-row in PHP so it runs on both MySQL and the SQLite test DB.
        DB::table('deals')
            ->whereNotNull('deleted_at')
            ->where('slug', 'not like', '%--deleted-%')
            ->orderBy('id')
            ->each(function ($deal) {
                $suffix = '--deleted-' . $deal->id;

                DB::table('deals')->where('id', $deal->id)->update([
                    'slug' => mb_substr($deal->slug, 0, 230) . $suffix,
                    'code' => $deal->code ? mb_substr($deal->code, 0, 50 - mb_strlen($suffix)) . $suffix : null,
                ]);
            });
    }

    public function down(): void
    {
        // Irreversible data cleanup; nothing to restore.
    }
};
