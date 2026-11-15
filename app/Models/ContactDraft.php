<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** What a visitor had typed into the public contact form (saved once name and a valid phone are filled). */
class ContactDraft extends Model
{
    protected $fillable = ['session_id', 'name', 'phone', 'email', 'subject', 'message', 'status', 'note', 'last_seen_at'];

    protected function casts(): array
    {
        return ['last_seen_at' => 'datetime'];
    }
}
