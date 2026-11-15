<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

/** One anonymous funnel step (add_to_cart, begin_booking, form_started, booking_submitted). No personal data. */
class SiteEvent extends Model
{
    public const UPDATED_AT = null;

    public const EVENTS = ['add_to_cart', 'begin_booking', 'form_started', 'booking_submitted', 'session_start', 'page_view', 'cart_update'];

    protected $fillable = ['session_id', 'event', 'path', 'meta', 'ip', 'user_agent'];

    protected function casts(): array
    {
        return ['meta' => 'array'];
    }
}
