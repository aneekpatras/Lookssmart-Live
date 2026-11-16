<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Support\SalonTimezone;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Staff alert: "Customer confirmed LS-XXXX" (admin bell and email), same mechanism as the other admin alerts. */
class CustomerConfirmedBookingAlert extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Booking $booking) {}

    /** @return array<int, string> */
    public function via(mixed $notifiable): array
    {
        return ['mail', 'database'];
    }

    /** @return array<string, mixed> */
    public function toArray(mixed $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'code' => $this->booking->code,
            'message' => "Customer confirmed {$this->booking->code}.",
        ];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        $booking = $this->booking->loadMissing(['items.service', 'customer']);
        $local = $booking->starts_at->clone()->setTimezone(SalonTimezone::DISPLAY);

        return (new MailMessage)
            ->subject("Customer confirmed {$booking->code}")
            ->view('mail.admin-customer-confirmed', [
                'customer_name' => $booking->customer?->name ?? $booking->guest_name ?? 'Guest',
                'service_name' => $booking->items->map(fn ($item) => $item->service?->name ?? 'Service')->implode(', '),
                'booking_code' => $booking->code,
                'booking_date' => $local->format('D, M j, Y'),
                'booking_time' => $local->format('g:i A'),
                'cta_url' => route('admin.bookings.show', $booking),
            ]);
    }
}
