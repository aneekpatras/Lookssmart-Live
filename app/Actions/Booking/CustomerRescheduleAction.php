<?php

namespace App\Actions\Booking;

use App\Models\Booking;
use App\Models\Setting;
use App\Services\AvailabilityEngine;
use App\Support\SalonTimezone;
use Carbon\CarbonImmutable;
use Illuminate\Validation\ValidationException;

/**
 * Customer-side reschedule (My Bookings and the signed email page). Adds only the customer rules
 * (status, future start, minimum lead time, slot still open) in front of the existing
 * RescheduleBookingAction, which still does the real move, the double-booking guard, the status log
 * and the rescheduled notifications. The booking keeps its status.
 */
class CustomerRescheduleAction
{
    public function __construct(
        private readonly AvailabilityEngine $engine,
        private readonly RescheduleBookingAction $reschedule,
    ) {}

    /** The "ask us on WhatsApp" line used in refusals. */
    public static function helpLine(): string
    {
        return Booking::cancelPolicyText();
    }

    /** Why this booking cannot be rescheduled by the customer right now, or null when it can. */
    public static function blockedReason(Booking $booking): ?string
    {
        if (! in_array($booking->status, ['pending', 'confirmed'], true)) {
            return 'This booking can no longer be rescheduled online.';
        }
        if ($booking->starts_at->isPast()) {
            return 'This appointment time has already passed.';
        }

        $minHours = self::minHours();
        if ($minHours > 0 && now()->diffInMinutes($booking->starts_at, false) < $minHours * 60) {
            return "Online changes close {$minHours} hour" . ($minHours === 1 ? '' : 's') . ' before the appointment. Please message us on WhatsApp and we will help.';
        }

        return null;
    }

    public static function minHours(): int
    {
        try {
            return max(0, (int) Setting::get('booking.reschedule_min_hours', 0));
        } catch (\Throwable) {
            return 0;
        }
    }

    /**
     * Slots for one day for this booking's own services, with its current slot counted as free.
     *
     * @return \Illuminate\Support\Collection<int, array<string, mixed>>
     */
    public function slots(Booking $booking, string $date, string $timezone)
    {
        $booking->loadMissing('items');

        return $this->engine->getSlots(
            $booking->items->pluck('service_id')->all(),
            $date,
            $timezone,
            $booking->id,
        );
    }

    public function execute(Booking $booking, CarbonImmutable $startsAtUtc, string $timezone, ?int $userId): Booking
    {
        if ($reason = self::blockedReason($booking)) {
            throw ValidationException::withMessages(['booking' => $reason]);
        }

        $booking->loadMissing('items.service');
        $serviceIds = $booking->items->pluck('service_id')->all();

        // The salon-wide capacity grid says the new slot is open (this booking's own slot is ignored).
        $day = $startsAtUtc->setTimezone($timezone)->toDateString();
        $slot = $this->slots($booking, $day, $timezone)
            ->first(fn (array $s) => CarbonImmutable::parse($s['starts_at'])->equalTo($startsAtUtc));

        if (! $slot || ! $slot['is_available']) {
            throw new SlotUnavailableException($this->slots($booking, $day, $timezone)->filter(fn (array $s) => $s['is_available'])->take(3)->values());
        }

        // Prefer the staff member already on the booking; otherwise whoever is free.
        $candidates = $this->engine->resolveStaffCandidates($serviceIds, $startsAtUtc, $timezone, $booking->id);
        $staffId = $candidates->contains($booking->staff_id) ? $booking->staff_id : $candidates->first();

        if (! $staffId) {
            throw new SlotUnavailableException(collect());
        }

        $old = $booking->starts_at->clone()->setTimezone(SalonTimezone::DISPLAY)->format('D j M, g:i A');
        $new = $startsAtUtc->setTimezone(SalonTimezone::DISPLAY)->format('D j M, g:i A');

        return $this->reschedule->execute(
            booking: $booking,
            staffId: (int) $staffId,
            startsAt: $startsAtUtc->setTimezone('UTC'),
            timezone: $timezone,
            reason: "Rescheduled by customer: {$old} to {$new}",
            rescheduledBy: $userId,
            bypassPolicyWindow: true, // the customer rules above replace the 24h policy window
        );
    }
}
