<?php

namespace App\Notifications;

use App\Channels\MailChannel;
use App\Channels\SmsChannel;
use App\Channels\WhatsappChannel;
use App\Models\Booking;
use App\Support\NotificationPreferenceService;
use App\Support\SalonTimezone;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Brief §4 / Phase 8 items 2-3: "reminder" branded email — template built here; the actual trigger
 * (an active `ReminderRule` matched by `SendDueRemindersJob`) is Phase 8 sub-step 2's job.
 */
class BookingReminder extends Notification implements ShouldQueue
{
    use Queueable;

    /** @param array<int, string> $channels */
    public function __construct(
        private readonly Booking $booking,
        private readonly array $channels = ['email', 'sms', 'whatsapp'],
        private readonly ?int $offsetMinutes = null,
        private readonly bool $test = false,
    ) {}

    /** @return array<int, string> */
    public function via(mixed $notifiable): array
    {
        // Guests are reached through an on-demand mail route: mail only (no database or phone channels).
        if ($notifiable instanceof \Illuminate\Notifications\AnonymousNotifiable) {
            return filled($notifiable->routeNotificationFor('mail')) ? [MailChannel::class] : [];
        }

        return array_values(array_filter([
            in_array('email', $this->channels, true) && filled($notifiable->email ?? null) ? MailChannel::class : null,
            in_array('sms', $this->channels, true) && filled(config('services.twilio.sid')) && filled(config('services.twilio.auth_token')) ? SmsChannel::class : null,
            in_array('whatsapp', $this->channels, true) && filled(config('services.twilio.sid')) && filled(config('services.twilio.auth_token')) ? WhatsappChannel::class : null,
            'database',
        ]));
    }

    public function toSms(mixed $notifiable): string
    {
        return 'Reminder: your appointment for ' . $this->booking->code . ' is on ' . $this->booking->starts_at->format('D, M j, Y') . ' at ' . $this->booking->starts_at->format('g:i A') . '. Stop SMS: ' . NotificationPreferenceService::unsubscribeUrl($notifiable, 'sms');
    }

    public function toWhatsapp(mixed $notifiable): string
    {
        return $this->toSms($notifiable);
    }

    /** "30 minutes", "24 hours", "2 days": how long until the appointment, as the rule states it. */
    public static function humanLead(?int $minutes): ?string
    {
        if (! $minutes || $minutes < 1) {
            return null;
        }
        if ($minutes % 1440 === 0 && $minutes >= 2880) {
            return ($minutes / 1440) . ' days';
        }
        if ($minutes % 60 === 0) {
            $hours = $minutes / 60;

            return $hours . ($hours === 1 ? ' hour' : ' hours');
        }

        return $minutes . ' minutes';
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        $booking = $this->booking->loadMissing(['items.service']);
        $services = $booking->items->map(fn ($item) => $item->service?->name ?? 'Service')->values()->all();
        $customerName = $booking->customer?->name ?? $booking->guest_name ?? 'there';
        $localStart = $booking->starts_at->clone()->setTimezone(SalonTimezone::DISPLAY);
        $links = \App\Http\Controllers\BookingLinkController::emailLinks($booking);
        $lead = self::humanLead($this->offsetMinutes);

        try {
            $address = (string) app(\App\Services\SeoService::class)->findUs()['address'];
        } catch (\Throwable) {
            $address = '';
        }

        return (new MailMessage)
            ->subject(($this->test ? '[Test] ' : '') . ($lead ? "Reminder: your appointment is in {$lead}" : 'Reminder: your appointment is coming up') . " — {$booking->code}")
            ->view('mail.booking-reminder', [
                'customer_name' => $customerName,
                'lead' => $lead,
                'services' => $services,
                'booking_code' => $booking->code,
                'when' => $localStart->format('D j M, g:i A'),
                'total' => \App\Support\CurrencyFormatter::format($booking->total),
                'address' => $address,
                'phone' => (string) (\App\Models\Setting::get('business.phone') ?: '+92 305 9833859'),
                'policy' => Booking::cancelPolicyText(),
                'cta_url' => $links['page_url'] ?? url('/book'),
                'confirm_url' => $links['confirm_url'],
                'reschedule_url' => $links['reschedule_url'],
                'cancel_url' => $links['cancel_url'],
                'test' => $this->test,
                'unsubscribe_url' => NotificationPreferenceService::unsubscribeUrl($notifiable, 'mail'),
            ]);
    }

    /** @return array<string, mixed> */
    public function toArray(mixed $notifiable): array
    {
        return [
            'booking_id' => $this->booking->id,
            'code' => $this->booking->code,
            'starts_at' => $this->booking->starts_at->toIso8601String(),
            'message' => "Reminder: booking {$this->booking->code} is coming up.",
        ];
    }
}
