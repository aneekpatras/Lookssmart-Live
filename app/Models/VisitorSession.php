<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One anonymous browser session (a random id kept in localStorage). Device, source and IP-based city are
 * worked out once, when the row is created. Name, phone and user_id are filled only when the visitor
 * gives them (booking draft, contact draft, register, login). */
class VisitorSession extends Model
{
    protected $fillable = [
        'session_id', 'first_seen_at', 'last_seen_at', 'ip', 'user_agent', 'device_type', 'browser', 'os', 'screen',
        'language', 'timezone', 'source', 'landing_path', 'country', 'region', 'city', 'is_bot', 'user_id', 'name',
        'phone', 'cart', 'cart_total', 'cart_updated_at', 'status', 'note', 'pages_count',
    ];

    protected function casts(): array
    {
        return [
            'first_seen_at' => 'datetime',
            'last_seen_at' => 'datetime',
            'cart_updated_at' => 'datetime',
            'cart' => 'array',
            'cart_total' => 'decimal:2',
            'is_bot' => 'boolean',
        ];
    }
}
