<?php

namespace Database\Seeders;

use App\Models\Deal;
use App\Models\GalleryImage;
use App\Models\Service;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Schema;

/**
 * LOCAL TESTING ONLY. Links gallery photos that have no link yet to existing services and live
 * deals (about one in four to a deal). Idempotent: already-linked photos are never touched.
 * Run: php artisan db:seed --class=GalleryLinkDummySeeder
 */
class GalleryLinkDummySeeder extends Seeder
{
    public function run(): void
    {
        if (! Schema::hasColumn('gallery_images', 'linked_type')) {
            $this->command?->warn('Run php artisan migrate first (linked_type column missing).');

            return;
        }

        $services = Service::active()->orderBy('id')->pluck('id')->all();
        $deals = Deal::active()->has('services')->orderBy('id')->pluck('id')->all();

        if ($services === [] && $deals === []) {
            $this->command?->warn('No active services or live deals to link to.');

            return;
        }

        $count = 0;

        GalleryImage::whereNull('linked_type')->orderBy('id')->get()->each(function (GalleryImage $image, int $i) use ($services, $deals, &$count) {
            $useDeal = $deals !== [] && ($services === [] || $i % 4 === 3);
            $pool = $useDeal ? $deals : $services;

            $image->update([
                'linked_type' => $useDeal ? 'deal' : 'service',
                'linked_id' => $pool[$i % count($pool)],
            ]);
            $count++;
        });

        $this->command?->info("Linked {$count} gallery photo(s).");
    }
}
