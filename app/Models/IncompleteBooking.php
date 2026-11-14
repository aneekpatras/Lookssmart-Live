<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class IncompleteBooking extends Model
{
    protected $fillable = ['session_id', 'name', 'phone', 'items', 'total', 'status', 'last_seen_at'];

    protected function casts(): array
    {
        return ['items' => 'array', 'total' => 'decimal:2', 'last_seen_at' => 'datetime'];
    }
}
