<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class SecurityEvent extends Model
{
    public const UPDATED_AT = null;

    public const TYPES = ['login_success', 'login_failed', 'lockout', 'registered', 'password_reset', 'form_spam'];

    protected $fillable = ['type', 'ip', 'user_agent', 'user_id', 'subject'];
}
