<?php

namespace App\Http\Controllers;

use App\Http\Requests\Customer\UpdateCustomerPreferencesRequest;
use App\Models\Booking;
use App\Models\Setting;
use Illuminate\Http\RedirectResponse;
use Illuminate\Http\Request;
use Inertia\Inertia;
use Inertia\Response;

class CustomerDashboardController extends Controller
{
    public function index(Request $request): Response
    {
        $user = $request->user();
        $bookings = Booking::query()
            ->where('customer_id', $user->id)
            ->with(['items.service', 'dealRedemptions.deal.services:id'])
            ->latest('starts_at')
            ->paginate(10)
            ->withQueryString();

        return Inertia::render('Customer/Profile', [
            'bookings' => $bookings->through(fn (Booking $booking) => $this->bookingData($booking)),
            'upcoming' => Booking::query()
                ->where('customer_id', $user->id)
                ->whereIn('status', ['pending', 'confirmed'])
                ->where('starts_at', '>=', now())
                ->with(['items.service'])
                ->orderBy('starts_at')
                ->limit(3)
                ->get()
                ->map(fn (Booking $booking) => $this->bookingData($booking)),
            'profile' => [
                'phone' => $user->phone,
                'marketing_opt_in' => (bool) $user->customerProfile?->marketing_opt_in,
                'email_opt_out' => (bool) $user->customerProfile?->email_opt_out,
                'sms_opt_out' => (bool) $user->customerProfile?->sms_opt_out,
                'whatsapp_opt_out' => (bool) $user->customerProfile?->whatsapp_opt_out,
            ],
        ]);
    }

    /**
     * The dedicated "My Bookings" page (Brief follow-up task): every current and past appointment,
     * newest-first, with the fields the task names explicitly — booking id (the real `code`, not the
     * numeric PK, since `code` is what a customer would ever quote back to the salon), services,
     * date/time, total, and status — plus `can_cancel_free` so the frontend's fee-warning modal can
     * never disagree with what `CancelBookingAction` will actually accept.
     */
    public function bookings(Request $request): Response
    {
        $user = $request->user();
        $bookings = Booking::query()
            ->where('customer_id', $user->id)
            ->with(['items.service'])
            ->latest('starts_at')
            ->paginate(15)
            ->withQueryString();

        return Inertia::render('Customer/Bookings', [
            'bookings' => $bookings->through(fn (Booking $booking) => $this->bookingData($booking)),
        ]);
    }

    public function updatePreferences(UpdateCustomerPreferencesRequest $request): RedirectResponse
    {
        $user = $request->user();
        $data = $request->validated();
        $user->forceFill(['phone' => $data['phone'] ?? null])->save();
        $profile = $user->customerProfile()->firstOrCreate([]);
        $profile->forceFill([
            'marketing_opt_in' => (bool) ($data['marketing_opt_in'] ?? false),
            'email_opt_out' => (bool) ($data['email_opt_out'] ?? false),
            'sms_opt_out' => (bool) ($data['sms_opt_out'] ?? false),
            'whatsapp_opt_out' => (bool) ($data['whatsapp_opt_out'] ?? false),
        ])->save();

        return back()->with('status', 'Communication preferences updated.');
    }

    /**
     * Structured breakdown for the booking card: every booked service with its own duration and catalog
     * price, the deals applied (each with its real discount and resulting deal price), and the stored
     * subtotal/discount — so the card shows exactly how the saved total was reached.
     *
     * @return array<string, mixed>
     */
    private function bookingBreakdown(Booking $booking): array
    {
        $items = $booking->items->filter(fn ($item) => $item->service !== null);

        $deals = $booking->dealRedemptions
            ->filter(fn ($redemption) => $redemption->deal !== null)
            ->map(function ($redemption) use ($items) {
                $serviceIds = $redemption->deal->services->pluck('id')->all();
                $bundle = $items->filter(fn ($item) => in_array($item->service_id, $serviceIds, true));
                $catalog = round((float) $bundle->sum('price_snapshot'), 2);
                $discount = (float) $redemption->discount_amount;

                return [
                    'title' => $redemption->deal->title,
                    'service_ids' => $bundle->pluck('service_id')->values()->all(),
                    'catalog_price' => number_format($catalog, 2, '.', ''),
                    'discount' => number_format($discount, 2, '.', ''),
                    'price' => number_format(max(0, $catalog - $discount), 2, '.', ''),
                    // A coupon redemption (no bundled services) is shown as a discount line, not a deal row.
                    'is_bundle' => $bundle->isNotEmpty(),
                ];
            })
            ->filter(fn (array $deal) => $deal['is_bundle'])
            ->values();

        return [
            'items' => $items->map(fn ($item) => [
                'service_id' => $item->service_id,
                'name' => $item->service->name,
                'duration_min' => (int) $item->duration_snapshot,
                'price' => number_format((float) $item->price_snapshot, 2, '.', ''),
            ])->values(),
            'deals' => $deals,
            'subtotal' => number_format((float) $items->sum('price_snapshot'), 2, '.', ''),
            'discount' => number_format((float) $booking->discount, 2, '.', ''),
        ];
    }

    /** @return array<string, mixed> */
    private function bookingData(Booking $booking): array
    {
        return [
            'id' => $booking->id,
            'code' => $booking->code,
            'status' => $booking->status,
            'starts_at' => $booking->starts_at?->toIso8601String(),
            'ends_at' => $booking->ends_at?->toIso8601String(),
            'staff_id' => $booking->staff_id,
            'services' => $booking->items->map(fn ($item) => $item->service?->name)->filter()->values(),
            ...$this->bookingBreakdown($booking),
            'total' => (string) $booking->total,
            // Real, not a client-side guess — `Booking::isCustomerCancellable()`/
            // `isWithinCancellationWindow()` are the exact same checks `CancelBookingAction` itself
            // applies, so the frontend's cancel button and fee-warning modal can never disagree with
            // what the API will actually accept.
            'can_cancel' => $booking->isCustomerCancellable() && $booking->starts_at?->isFuture(),
            'can_reschedule' => \App\Actions\Booking\CustomerRescheduleAction::blockedReason($booking) === null,
            // Why an upcoming pending/confirmed booking cannot be moved online (shown with the WhatsApp link).
            'reschedule_note' => $booking->isCustomerCancellable() && $booking->starts_at?->isFuture()
                ? \App\Actions\Booking\CustomerRescheduleAction::blockedReason($booking)
                : null,
            'within_cancellation_fee_window' => $booking->isWithinCancellationWindow(),
        ];
    }
}
