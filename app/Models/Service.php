<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Factories\HasFactory;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;
use Illuminate\Database\Eloquent\Relations\BelongsToMany;
use Illuminate\Database\Eloquent\Relations\HasMany;
use Illuminate\Database\Eloquent\SoftDeletes;
use Spatie\Image\Enums\Fit;
use Spatie\MediaLibrary\HasMedia;
use Spatie\MediaLibrary\InteractsWithMedia;
use Spatie\MediaLibrary\MediaCollections\Models\Media;

class Service extends Model implements HasMedia
{
    use HasFactory, InteractsWithMedia, SoftDeletes;

    protected $fillable = [
        'service_category_id',
        'sku',
        'name',
        'slug',
        'stock_image_url',
        'description',
        'duration_min',
        'buffer_min',
        'base_price',
        'is_featured',
        'is_active',
        'sort',
        'seo_title',
        'seo_description',
        'faq',
    ];

    /**
     * `slug` and `sku` are UNIQUE at the DB level and soft-deleted rows still occupy them, so a
     * deleted service would block re-creating/re-importing the same name. On soft delete we rename
     * them out of the way (the row stays intact for past bookings/reports).
     */
    protected static function booted(): void
    {
        static::deleting(function (Service $service) {
            if ($service->isForceDeleting()) {
                return;
            }

            $suffix = '--deleted-' . $service->id;
            $service->slug = mb_substr((string) $service->slug, 0, 255 - mb_strlen($suffix)) . $suffix;
            $service->sku = $service->sku ? mb_substr($service->sku, 0, 255 - mb_strlen($suffix)) . $suffix : null;
            $service->saveQuietly();
        });
    }

    protected function casts(): array
    {
        return [
            'base_price' => 'decimal:2',
            'is_featured' => 'boolean',
            'is_active' => 'boolean',
            'faq' => 'array',
        ];
    }

    /**
     * Same server-side-sniffed MIME allowlist as ServiceCategory — see that model's docblock.
     */
    public function registerMediaCollections(): void
    {
        $this->addMediaCollection('image')
            ->singleFile()
            ->acceptsMimeTypes(['image/jpeg', 'image/png', 'image/webp', 'image/gif']);
    }

    public function registerMediaConversions(?Media $media = null): void
    {
        $this->addMediaConversion('thumb')
            ->width(400)
            ->height(400)
            ->sharpen(10)
            ->nonQueued();

        // Public service cards render ~470px wide (up to 2x on retina); the 400px square 'thumb'
        // above is only right for admin tables, and looks soft when stretched into a card.
        $this->addMediaConversion('card')
            ->fit(Fit::Crop, 960, 540)
            ->nonQueued();

        // Detail-page banner: sharp at full width, but far lighter than a multi-MB original upload.
        $this->addMediaConversion('banner')
            ->width(1600)
            ->nonQueued();
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(ServiceCategory::class, 'service_category_id');
    }

    public function staff(): BelongsToMany
    {
        return $this->belongsToMany(Staff::class);
    }

    public function prices(): HasMany
    {
        return $this->hasMany(ServicePrice::class);
    }

    public function reviews(): HasMany
    {
        return $this->hasMany(Review::class);
    }

    public function deals(): BelongsToMany
    {
        return $this->belongsToMany(Deal::class);
    }

    public function scopeActive($query)
    {
        return $query->where('is_active', true);
    }

    public function scopeFeatured($query)
    {
        return $query->where('is_featured', true);
    }
}
