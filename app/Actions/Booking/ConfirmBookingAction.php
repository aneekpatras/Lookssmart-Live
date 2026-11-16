<?php

namespace App\Actions\Booking;

use App\Models\Booking;
use App\Models\User;
use App\Notifications\CustomerConfirmedBookingAlert;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;
use Illuminate\Validation\ValidationException;

/**
 * The one way a pending booking gets confirmed outside the admin status dropdown: the customer's
 * email link, the customer's account, and the staff "Mark confirmed" button all come through here, and
 * all end in TransitionBookingStatusAction (state machine + status log + who/how/when).
 */
class ConfirmBookingAction
{
    public const VIA_EMAIL = 'customer_email';

    public const VIA_ACCOUNT = 'customer_account';

    public const VIA_STAFF = 'staff';

    public function __construct(private readonly TransitionBookingStatusAction $transition) {}

    /** @return 'confirmed'|'already' */
    public function execute(Booking $booking, string $via, ?int $byUserId = null): string
    {
        if ($booking->status === 'confirmed') {
            return 'already';
        }

        if ($booking->status !== 'pending') {
            throw ValidationException::withMessages([
                'booking' => 'This booking can no longer be confirmed.',
            ]);
        }

        if ($booking->starts_at->isPast()) {
            throw ValidationException::withMessages([
                'booking' => 'This appointment time has already passed.',
            ]);
        }

        $reason = match ($via) {
            self::VIA_STAFF => 'Confirmed by staff',
            self::VIA_ACCOUNT => 'Confirmed by customer (account)',
            default => 'Confirmed by customer (email link)',
        };

        $this->transition->execute($booking, 'confirmed', $reason, $byUserId, $via);

        if ($via !== self::VIA_STAFF) {
            $this->notifyStaff($booking->fresh());
        }

        return 'confirmed';
    }

    private function notifyStaff(Booking $booking): void
    {
        $admins = User::adminRecipients();

        try {
            if ($admins->isNotEmpty()) {
                Notification::send($admins, new CustomerConfirmedBookingAlert($booking));
            }
        } catch (\Throwable $e) {
            Log::error("Failed to send CustomerConfirmedBookingAlert for {$booking->code}: {$e->getMessage()}", ['exception' => $e]);
        }
    }
}
