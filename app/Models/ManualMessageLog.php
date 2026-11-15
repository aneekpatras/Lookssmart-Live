<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** A WhatsApp chat staff opened from the Reminders page (reminder or birthday). Nothing is sent automatically. */
class ManualMessageLog extends Model
{
    protected $fillable = ['type', 'booking_id', 'customer_id', 'phone', 'message', 'sent_by', 'sent_at'];

    protected function casts(): array
    {
        return ['sent_at' => 'datetime'];
    }

    public function sender(): BelongsTo
    {
        return $this->belongsTo(User::class, 'sent_by');
    }
}
