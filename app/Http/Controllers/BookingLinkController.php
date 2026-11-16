<?php

namespace App\Http\Controllers;

use App\Actions\Booking\CancelBookingAction;
use App\Actions\Booking\ConfirmBookingAction;
use App\Actions\Booking\CustomerRescheduleAction;
use App\Actions\Booking\SlotUnavailableException;
use App\Models\Booking;
use App\Models\Setting;
use App\Support\CurrencyFormatter;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\URL;
use Illuminate\Validation\ValidationException;
use Inertia\Inertia;
use Symfony\Component\HttpFoundation\Response;

/**
 * The page behind the "Confirm my booking" / "Reschedule" links in booking emails. Every URL is a
 * temporary signed URL that expires when the appointment ends. GET only ever shows things (email
 * security scanners open links); only the POSTs change anything. Shows the booking summary and nothing
 * else personal.
 */
class BookingLinkController extends Controller
{
    /** Signed page link for a booking, valid until the appointment ends. */
    public static function url(Booking $booking, string $route = 'booking.link.show'): string
    {
        return URL::temporarySignedRoute($route, $booking->ends_at, ['booking' => $booking->code]);
    }

    /**
     * Links for a booking email. The "Confirm my booking" button (pending bookings only) and the
     * "Reschedule" text link both open the signed page; nothing happens until the customer presses
     * a button there. Empty when the booking can no longer be changed.
     *
     * @return array{page_url: ?string, confirm_url: ?string, reschedule_url: ?string, cancel_url: ?string}
     */
    public static function emailLinks(Booking $booking): array
    {
        try {
            if (! in_array($booking->status, ['pending', 'confirmed'], true) || $booking->ends_at->isPast()) {
                return ['page_url' => null, 'confirm_url' => null, 'reschedule_url' => null, 'cancel_url' => null];
            }
            $page = self::url($booking);

            return [
                'page_url' => $page,
                'confirm_url' => $booking->status === 'pending' ? $page : null,
                'reschedule_url' => $page . '#reschedule',
                'cancel_url' => $page . '#cancel',
            ];
        } catch (\Throwable) {
            return ['page_url' => null, 'confirm_url' => null, 'reschedule_url' => null, 'cancel_url' => null];
        }
    }

    public function show(Request $request, Booking $booking): Response
    {
        if (! $request->hasValidSignature()) {
            return $this->invalidPage($request);
        }

        $booking->loadMissing('items.service');

        return $this->noIndex(Inertia::render('Public/BookingLink', [
            'invalid' => false,
            'whatsapp' => $this->whatsapp(),
            'booking' => [
                'code' => $booking->code,
                'status' => $booking->status,
                'starts_at' => $booking->starts_at->toIso8601String(),
                'ends_at' => $booking->ends_at->toIso8601String(),
                'services' => $booking->items->map(fn ($item) => $item->service?->name)->filter()->values(),
                'total' => CurrencyFormatter::format($booking->total),
                'can_confirm' => $booking->status === 'pending' && $booking->starts_at->isFuture(),
                'reschedule_blocked' => CustomerRescheduleAction::blockedReason($booking),
                'can_cancel' => in_array($booking->status, ['pending', 'confirmed'], true) && $booking->starts_at->isFuture(),
            ],
            'cancelPolicy' => Booking::cancelPolicyText(),
            'urls' => [
                'confirm' => self::url($booking, 'booking.link.confirm'),
                'slots' => self::url($booking, 'booking.link.slots'),
                'reschedule' => self::url($booking, 'booking.link.reschedule'),
                'cancel' => self::url($booking, 'booking.link.cancel'),
            ],
        ])->toResponse($request));
    }

    public function slots(Request $request, Booking $booking, CustomerRescheduleAction $action): JsonResponse
    {
        if (! $request->hasValidSignature()) {
            return response()->json(['message' => 'This link is no longer valid.'], 403);
        }

        $data = $request->validate(['date' => ['required', 'date_format:Y-m-d'], 'timezone' => ['nullable', 'timezone']]);

        return response()->json(['slots' => $action->slots($booking, $data['date'], $data['timezone'] ?? 'Asia/Karachi')]);
    }

    public function confirm(Request $request, Booking $booking, ConfirmBookingAction $action): JsonResponse
    {
        if (! $request->hasValidSignature()) {
            return response()->json(['message' => 'This link is no longer valid.'], 403);
        }

        try {
            $result = $action->execute($booking, ConfirmBookingAction::VIA_EMAIL);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'result' => $result,
            'status' => $booking->fresh()->status,
            'message' => $result === 'already' ? 'This booking is already confirmed. Thank you!' : 'Thank you, your booking is confirmed.',
        ]);
    }

    /** Cancel from the email link: POST only, same cancel action (and notifications) as everywhere else. */
    public function cancel(Request $request, Booking $booking, CancelBookingAction $action): JsonResponse
    {
        if (! $request->hasValidSignature()) {
            return response()->json(['message' => 'This link is no longer valid.'], 403);
        }

        if (! in_array($booking->status, ['pending', 'confirmed'], true) || $booking->starts_at->isPast()) {
            return response()->json(['message' => 'This booking can no longer be cancelled online.'], 422);
        }

        try {
            $action->execute($booking, 'Cancelled by customer (email link)', null, false);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json(['status' => $booking->fresh()->status, 'message' => 'Your booking has been cancelled.']);
    }

    public function reschedule(Request $request, Booking $booking, CustomerRescheduleAction $action): JsonResponse
    {
        if (! $request->hasValidSignature()) {
            return response()->json(['message' => 'This link is no longer valid.'], 403);
        }

        $data = $request->validate(['starts_at' => ['required', 'date'], 'timezone' => ['required', 'timezone']]);

        try {
            $moved = $action->execute($booking, CarbonImmutable::parse($data['starts_at'])->setTimezone('UTC'), $data['timezone'], null);
        } catch (SlotUnavailableException $e) {
            return response()->json(['message' => 'That time was just taken. Please pick another.', 'alternatives' => $e->alternatives()], 409);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'status' => $moved->status,
            'starts_at' => $moved->starts_at->toIso8601String(),
            'ends_at' => $moved->ends_at->toIso8601String(),
        ]);
    }

    private function invalidPage(Request $request): Response
    {
        return $this->noIndex(Inertia::render('Public/BookingLink', [
            'invalid' => true,
            'whatsapp' => $this->whatsapp(),
        ])->toResponse($request), 403);
    }

    private function noIndex(Response $response, int $status = 200): Response
    {
        $response->setStatusCode($status);
        $response->headers->set('X-Robots-Tag', 'noindex, nofollow');
        $response->headers->set('Cache-Control', 'no-store, private');

        return $response;
    }

    private function whatsapp(): string
    {
        $phone = preg_replace('/\D/', '', (string) (Setting::get('business.phone') ?: '+92 305 9833859'));

        return "https://wa.me/{$phone}";
    }
}
