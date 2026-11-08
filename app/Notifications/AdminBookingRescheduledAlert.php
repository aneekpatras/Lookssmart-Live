<?php

namespace App\Notifications;

use App\Models\Booking;
use App\Support\SalonTimezone;
use Carbon\CarbonInterface;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Admin-facing counterpart to `BookingRescheduled` (customers were told, admins never were). */
class AdminBookingRescheduledAlert extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(
        private readonly Booking $booking,
        private readonly CarbonInterface $previousStartsAt,
    ) {}

    /** @return array<int, string> */
    public function via(mixed $notifiable): array
    {
        if ($notifiable instanceof AnonymousNotifiable) {
            return ['mail'];
        }

        return ['mail', 'database'];
    }

    /** @return array<string, mixed> */
    public function toArray(mixed $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'code' => $this->booking->code,
            'message' => "Booking {$this->booking->code} was rescheduled.",
        ];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        $booking = $this->booking->loadMissing(['items.service', 'customer']);
        $serviceNames = $booking->items->map(fn ($item) => $item->service?->name ?? 'Service')->implode(', ');
        $localPrevious = $this->previousStartsAt->clone()->setTimezone(SalonTimezone::DISPLAY);
        $localStart = $booking->starts_at->clone()->setTimezone(SalonTimezone::DISPLAY);

        return (new MailMessage)
            ->subject("Booking rescheduled — {$booking->code}")
            ->view('mail.admin-booking-rescheduled', [
                'customer_name' => $booking->customer?->name ?? $booking->guest_name ?? 'Guest',
                'service_name' => $serviceNames,
                'booking_code' => $booking->code,
                'previous_date' => $localPrevious->format('D, M j, Y'),
                'previous_time' => $localPrevious->format('g:i A'),
                'booking_date' => $localStart->format('D, M j, Y'),
                'booking_time' => $localStart->format('g:i A'),
                'cta_url' => route('admin.bookings.show', $booking),
            ]);
    }
}
