<?php

namespace App\Http\Controllers;

use App\Actions\Booking\CustomerRescheduleAction;
use App\Actions\Booking\SlotUnavailableException;
use App\Models\Booking;
use Carbon\CarbonImmutable;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

/** Reschedule from My Bookings: only the logged-in owner of the booking. */
class CustomerRescheduleController extends Controller
{
    public function slots(Request $request, Booking $booking, CustomerRescheduleAction $action): JsonResponse
    {
        abort_unless($booking->customer_id === $request->user()->id, 403);
        $data = $request->validate(['date' => ['required', 'date_format:Y-m-d'], 'timezone' => ['nullable', 'timezone']]);

        return response()->json(['slots' => $action->slots($booking, $data['date'], $data['timezone'] ?? 'Asia/Karachi')]);
    }

    public function reschedule(Request $request, Booking $booking, CustomerRescheduleAction $action): JsonResponse
    {
        abort_unless($booking->customer_id === $request->user()->id, 403);
        $data = $request->validate(['starts_at' => ['required', 'date'], 'timezone' => ['required', 'timezone']]);

        try {
            $moved = $action->execute($booking, CarbonImmutable::parse($data['starts_at'])->setTimezone('UTC'), $data['timezone'], $request->user()->id);
        } catch (SlotUnavailableException $e) {
            return response()->json(['message' => 'That time was just taken. Please pick another.', 'alternatives' => $e->alternatives()], 409);
        } catch (ValidationException $e) {
            return response()->json(['message' => $e->getMessage()], 422);
        }

        return response()->json([
            'status' => $moved->status,
            'starts_at' => $moved->starts_at->toIso8601String(),
        ]);
    }
}
