<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

class Faq extends Model
{
    protected $fillable = [
        'faq_category_id',
        'question',
        'answer',
        'links',
        'sort_order',
        'is_active',
        'show_in_preview',
    ];

    protected function casts(): array
    {
        return [
            'links' => 'array',
            'is_active' => 'boolean',
            'show_in_preview' => 'boolean',
            'sort_order' => 'integer',
        ];
    }

    public function category(): BelongsTo
    {
        return $this->belongsTo(FaqCategory::class, 'faq_category_id');
    }
}
