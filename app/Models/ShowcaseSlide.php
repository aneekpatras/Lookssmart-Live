<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One image in the Home "showcase" slider (Admin > Home showcase). */
class ShowcaseSlide extends Model
{
    protected $fillable = ['image_path', 'title', 'subtitle', 'link', 'focus', 'sort_order', 'is_active'];

    protected function casts(): array
    {
        return ['is_active' => 'boolean', 'sort_order' => 'integer'];
    }
}
