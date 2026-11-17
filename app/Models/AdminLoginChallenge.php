<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;
use Illuminate\Database\Eloquent\Relations\BelongsTo;

/** One pending email sign-in for an admin account. Holds hashes only, never the code or the link token. */
class AdminLoginChallenge extends Model
{
    public const MAX_ATTEMPTS = 5;

    protected $fillable = ['user_id', 'code_hash', 'token_hash', 'session_hash', 'attempts', 'sent_count', 'expires_at', 'used_at', 'ip', 'user_agent'];

    protected $hidden = ['code_hash', 'token_hash', 'session_hash'];

    protected function casts(): array
    {
        return ['expires_at' => 'datetime', 'used_at' => 'datetime'];
    }

    public function user(): BelongsTo
    {
        return $this->belongsTo(User::class);
    }

    public function isUsable(): bool
    {
        return $this->used_at === null && $this->expires_at->isFuture() && $this->attempts < self::MAX_ATTEMPTS;
    }
}
