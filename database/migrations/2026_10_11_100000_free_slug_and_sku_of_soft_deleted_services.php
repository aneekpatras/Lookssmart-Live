<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

/**
 * Soft-deleted services kept their UNIQUE slug/sku, blocking re-creation/re-import of the same
 * service. Service::booted() now renames them on delete; this renames the ones already deleted.
 */
return new class extends Migration
{
    public function up(): void
    {
        // Row-by-row in PHP (not one SQL UPDATE) so it runs on both MySQL and the SQLite test DB.
        DB::table('services')
            ->whereNotNull('deleted_at')
            ->where('slug', 'not like', '%--deleted-%')
            ->orderBy('id')
            ->each(function ($service) {
                $suffix = '--deleted-' . $service->id;

                DB::table('services')->where('id', $service->id)->update([
                    'slug' => mb_substr($service->slug, 0, 230) . $suffix,
                    'sku' => $service->sku ? mb_substr($service->sku, 0, 230) . $suffix : null,
                ]);
            });
    }

    public function down(): void
    {
        // Irreversible data cleanup; nothing to restore.
    }
};
