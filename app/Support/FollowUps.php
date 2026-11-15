<?php

namespace App\Support;

use App\Models\ContactDraft;
use App\Models\IncompleteBooking;
use App\Models\VisitorSession;
use Illuminate\Support\Facades\Schema;

/**
 * Keeps the follow-up tables consistent. Every method is safe to call before the tables exist and never
 * throws: tracking must not get in the way of a booking or a contact message.
 */
class FollowUps
{
    private static function has(string $table): bool
    {
        try {
            return Schema::hasTable($table);
        } catch (\Throwable) {
            return false;
        }
    }

    /** Copies a name, phone and account onto the visitor session row (only the pieces that are known). */
    public static function linkIdentity(?string $sessionId, ?string $name = null, ?string $phone = null, ?int $userId = null): void
    {
        if (! $sessionId || ! self::has('visitor_sessions')) {
            return;
        }

        try {
            $session = VisitorSession::where('session_id', $sessionId)->first();
            if (! $session) {
                return;
            }

            $changes = array_filter([
                'name' => $name ? mb_substr(trim(strip_tags($name)), 0, 100) : null,
                'phone' => $phone ? Phone::normalize($phone) : null,
                'user_id' => $userId,
            ], fn ($value) => $value !== null && $value !== '');

            if ($changes !== []) {
                $session->update($changes);
            }
        } catch (\Throwable) {
            // ignore
        }
    }

    /** The contact form was really sent: its draft becomes "sent" (never shown as unsent). */
    public static function markContactSent(?string $sessionId): void
    {
        if (! $sessionId || ! self::has('contact_drafts')) {
            return;
        }

        try {
            ContactDraft::where('session_id', $sessionId)->update(['status' => 'sent']);
        } catch (\Throwable) {
            // ignore
        }
    }

    /** A booking was submitted with this phone: close every matching follow-up so the lists stay clean. */
    public static function markBooked(?string $phone, ?string $sessionId = null): void
    {
        $phone = $phone ? Phone::fromStored($phone) : null;

        try {
            if ($phone && self::has('incomplete_bookings')) {
                IncompleteBooking::where('phone', $phone)->where('status', '!=', 'converted')->update(['status' => 'converted']);
            }
            if ($phone && self::has('contact_drafts')) {
                ContactDraft::where('phone', $phone)->whereNotIn('status', ['sent', 'booked'])->update(['status' => 'booked']);
            }
            if (self::has('visitor_sessions')) {
                VisitorSession::query()
                    ->when($phone || $sessionId, fn ($q) => $q->where(function ($inner) use ($phone, $sessionId) {
                        if ($phone) {
                            $inner->orWhere('phone', $phone);
                        }
                        if ($sessionId) {
                            $inner->orWhere('session_id', $sessionId);
                        }
                    }))
                    ->when(! $phone && ! $sessionId, fn ($q) => $q->whereRaw('1 = 0'))
                    ->update(['status' => 'booked']);
            }
        } catch (\Throwable) {
            // ignore
        }
    }
}
