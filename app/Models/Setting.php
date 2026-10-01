<?php

namespace App\Models;

use App\Concerns\LogsAuditableActivity;
use Illuminate\Database\Eloquent\Model;
use Illuminate\Support\Facades\Cache;
use Spatie\Activitylog\LogOptions;
use Spatie\Activitylog\Traits\LogsActivity;

class Setting extends Model
{
    use LogsActivity, LogsAuditableActivity;

    private const CACHE_KEY = 'settings:all';

    protected $fillable = [
        'key',
        'value',
        'group',
        'is_encrypted',
    ];

    protected function casts(): array
    {
        return [
            'value' => 'array',
            'is_encrypted' => 'boolean',
        ];
    }

    protected static function booted(): void
    {
        static::saved(fn () => static::flushCache());
        static::deleted(fn () => static::flushCache());
    }

    public function scopeGroup($query, string $group)
    {
        return $query->where('group', $group);
    }

    /**
     * Every setting in ONE cached array (5 min, database-backed cache since the 2026-09-28
     * Redis-removal migration, Decision #49). The shared Inertia props alone read ~15 keys per
     * request, which as per-key cache entries meant ~15 cache-table queries; this is one.
     * Invalidated on save/delete via the model events above. Loads full models (not a raw
     * pluck) so the `array` cast on `value` runs. Settings only — never availability, POS or payments.
     *
     * @return array<string, mixed>
     */
    protected static function allCached(): array
    {
        return Cache::remember(self::CACHE_KEY, 300, fn () => static::query()->get()->mapWithKeys(fn (Setting $setting) => [$setting->key => $setting->value])->all());
    }

    public static function flushCache(): void
    {
        Cache::forget(self::CACHE_KEY);
    }

    public static function get(string $key, mixed $default = null): mixed
    {
        $all = static::allCached();

        return array_key_exists($key, $all) ? ($all[$key] ?? $default) : $default;
    }

    public function getActivitylogOptions(): LogOptions
    {
        return LogOptions::defaults()
            ->logOnly(['key', 'value', 'group'])
            ->logOnlyDirty()
            ->dontSubmitEmptyLogs()
            ->useLogName('settings');
    }
}
