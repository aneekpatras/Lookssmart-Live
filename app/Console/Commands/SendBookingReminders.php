<?php

namespace App\Console\Commands;

use App\Models\Booking;
use App\Models\NotificationLog;
use App\Models\ReminderRule;
use App\Notifications\BookingReminder;
use App\Services\BookingReminderSchedule;
use Carbon\CarbonImmutable;
use Illuminate\Console\Command;
use Illuminate\Database\UniqueConstraintViolationException;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Notification;

/**
 * Sends booking reminders for every active "before the appointment" rule. What is due is decided by
 * BookingReminderSchedule (offset 30 minutes to 7 days, one hour of grace, never a late reminder, never
 * twice for the same booking, rule and start time). Account customers are notified directly; guest
 * bookings go to their guest email through an on-demand notifiable. Bookings with no email (and no
 * SMS/WhatsApp channel on the rule) are skipped silently.
 */
class SendBookingReminders extends Command
{
    protected $signature = 'bookings:send-reminders {--now= : ISO-8601 time used for a deterministic run}';

    protected $description = 'Dispatch due booking reminders without duplicates';

    public function handle(BookingReminderSchedule $schedule): int
    {
        $clock = $this->option('now') ? CarbonImmutable::parse($this->option('now')) : CarbonImmutable::now();
        $sent = 0;

        foreach ($schedule->rules() as $rule) {
            foreach ($schedule->dueBookings($rule, $clock) as $booking) {
                if ($this->remind($rule, $booking)) {
                    $sent++;
                }
            }
        }

        $this->info("Dispatched {$sent} booking reminder(s).");

        return self::SUCCESS;
    }

    private function remind(ReminderRule $rule, Booking $booking): bool
    {
        $channels = $rule->channels ?: ['email'];
        $email = BookingReminderSchedule::recipientEmail($booking);
        $customer = $booking->customer;
        $otherChannels = array_diff($channels, ['email']) !== [];

        // Nobody to reach: no email, and no phone channel on the rule for an account customer.
        if (! $email && ! ($customer && $otherChannels)) {
            return false;
        }

        $recipient = $email ?? $customer?->phone ?? ('booking#' . $booking->id);

        if (! $this->claim(BookingReminderSchedule::key($rule, $booking), (string) $recipient)) {
            return false;
        }

        try {
            $notification = new BookingReminder($booking, $channels, (int) $rule->offset_minutes);

            if ($customer) {
                $customer->notify($notification);
            } else {
                Notification::route('mail', $email)->notify(new BookingReminder($booking, ['email'], (int) $rule->offset_minutes));
            }
        } catch (\Throwable $e) {
            Log::error("Failed to send BookingReminder for {$booking->code}: {$e->getMessage()}", ['exception' => $e]);

            return false;
        }

        return true;
    }

    private function claim(string $key, string $recipient): bool
    {
        try {
            NotificationLog::create([
                'channel' => 'reminder',
                'recipient' => $recipient,
                'status' => 'pending',
                'reminder_key' => $key,
            ]);

            return true;
        } catch (UniqueConstraintViolationException) {
            return false;
        }
    }
}
