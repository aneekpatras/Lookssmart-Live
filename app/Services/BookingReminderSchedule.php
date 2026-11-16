<?php

namespace App\Services;

use App\Models\Booking;
use App\Models\NotificationLog;
use App\Models\ReminderRule;
use Carbon\CarbonInterface;
use Illuminate\Support\Collection;

/**
 * When is a booking reminder due? One small service used by bookings:send-reminders and by the admin
 * "Upcoming reminders" preview, so the preview can never disagree with what the command will do.
 *
 * A rule (offset N minutes before the start) is due for a booking when:
 *  - now >= start - N and now < start - N + GRACE (if the scheduler was down longer, the reminder is
 *    skipped, never sent late),
 *  - the booking existed before start - N (a booking made 3 hours ahead gets no 24h reminder),
 *  - status is pending or confirmed and the start is still in the future.
 * The idempotency key contains the booking, the rule and the start time, so a rescheduled booking gets
 * its reminders again and nothing is ever sent twice.
 */
class BookingReminderSchedule
{
    public const MIN_MINUTES = 30;

    public const MAX_MINUTES = 10080; // 7 days

    public const GRACE_MINUTES = 60;

    private const STATUSES = ['pending', 'confirmed'];

    public static function key(ReminderRule $rule, Booking $booking): string
    {
        return "booking-reminder:{$booking->id}:{$rule->id}:{$booking->starts_at->getTimestamp()}";
    }

    /** The email address a reminder would go to: the account's, otherwise the guest's. */
    public static function recipientEmail(Booking $booking): ?string
    {
        foreach ([$booking->customer?->email, $booking->guest_email] as $email) {
            if (filled($email) && filter_var($email, FILTER_VALIDATE_EMAIL)) {
                return (string) $email;
            }
        }

        return null;
    }

    public static function plannedSendAt(ReminderRule $rule, Booking $booking): CarbonInterface
    {
        return $booking->starts_at->clone()->subMinutes((int) $rule->offset_minutes);
    }

    /** Active booking-reminder rules whose offset is inside the supported range. */
    public function rules(): Collection
    {
        return ReminderRule::active()
            ->where('event', 'before_booking')
            ->where('direction', 'before')
            ->whereBetween('offset_minutes', [self::MIN_MINUTES, self::MAX_MINUTES])
            ->orderBy('offset_minutes', 'desc')
            ->get();
    }

    public function isDue(ReminderRule $rule, Booking $booking, CarbonInterface $now): bool
    {
        if (! in_array($booking->status, self::STATUSES, true) || $booking->starts_at->lte($now)) {
            return false;
        }

        $planned = self::plannedSendAt($rule, $booking);

        if ($now->lt($planned) || $now->gte($planned->clone()->addMinutes(self::GRACE_MINUTES))) {
            return false;
        }

        return ! $booking->created_at || $booking->created_at->lte($planned);
    }

    /** @return Collection<int, Booking> */
    public function dueBookings(ReminderRule $rule, CarbonInterface $now): Collection
    {
        $offset = (int) $rule->offset_minutes;

        return Booking::query()
            ->with(['customer', 'items.service'])
            ->whereIn('status', self::STATUSES)
            ->where('starts_at', '>', $now)
            ->where('starts_at', '<=', $now->clone()->addMinutes($offset))
            ->where('starts_at', '>', $now->clone()->addMinutes($offset - self::GRACE_MINUTES))
            ->get()
            ->filter(fn (Booking $booking) => $this->isDue($rule, $booking, $now))
            ->values();
    }

    /**
     * What will be sent next, in order, without sending anything: reminders that are due right now
     * (inside the grace window) and those still ahead. Already-sent ones are left out.
     *
     * @return array<int, array{booking: Booking, rule: ReminderRule, planned_at: CarbonInterface, email: ?string}>
     */
    public function upcoming(CarbonInterface $now, int $limit = 20): array
    {
        $rules = $this->rules();
        if ($rules->isEmpty()) {
            return [];
        }

        $bookings = Booking::query()
            ->with(['customer', 'items.service'])
            ->whereIn('status', self::STATUSES)
            ->where('starts_at', '>', $now)
            ->where('starts_at', '<=', $now->clone()->addMinutes(self::MAX_MINUTES + self::GRACE_MINUTES))
            ->orderBy('starts_at')
            ->limit(500)
            ->get();

        $rows = [];
        foreach ($rules as $rule) {
            foreach ($bookings as $booking) {
                $planned = self::plannedSendAt($rule, $booking);

                // Missed (older than the grace window) or the booking did not exist yet at that time.
                if ($now->gte($planned->clone()->addMinutes(self::GRACE_MINUTES)) || ($booking->created_at && $booking->created_at->gt($planned))) {
                    continue;
                }

                $rows[] = ['booking' => $booking, 'rule' => $rule, 'planned_at' => $planned, 'email' => self::recipientEmail($booking)];
            }
        }

        usort($rows, fn (array $a, array $b) => $a['planned_at'] <=> $b['planned_at']);
        $rows = array_slice($rows, 0, $limit * 3);

        $sent = NotificationLog::whereIn('reminder_key', array_map(fn (array $row) => self::key($row['rule'], $row['booking']), $rows))
            ->pluck('reminder_key')->flip();

        $rows = array_values(array_filter($rows, fn (array $row) => ! isset($sent[self::key($row['rule'], $row['booking'])])));

        return array_slice($rows, 0, $limit);
    }
}
