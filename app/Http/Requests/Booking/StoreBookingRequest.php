<?php

namespace App\Http\Requests\Booking;

use App\Support\Phone;
use App\Http\Requests\BaseFormRequest;

class StoreBookingRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return true;
    }

    protected function prepareForValidation(): void
    {
        // Store one format everywhere: digits with country code, no plus (invalid input is left as typed
        // so the rule above can reject it).
        $this->merge([
            // Validated as typed (a logged-in customer falls back to the number on the account);
            // BookingController normalises it before it is stored.
            'guest_phone' => $this->input('guest_phone') ?: ($this->user()?->phone ? '+' . $this->user()->phone : null),
            'guest_email' => filled($this->input('guest_email')) ? trim((string) $this->input('guest_email')) : null,
        ]);
    }

    public function rules(): array
    {
        $guestRequired = ! $this->user();

        return [
            'service_ids' => ['required', 'array', 'min:1'],
            'service_ids.*' => ['integer', 'exists:services,id'],
            // Ad hoc task 30: the public wizard no longer picks a specific staff member (the slot
            // list is a salon-wide capacity grid) — optional here, auto-resolved server-side in
            // `BookingController::store()` when omitted. Still honoured as-is when a caller does
            // supply one.
            'staff_id' => ['nullable', 'integer', 'exists:staff,id'],
            'starts_at' => ['required', 'date'],
            'timezone' => ['required', 'timezone'],
            'guest_name' => [$guestRequired ? 'required' : 'nullable', 'string', 'max:255'],
            // Email is optional (validated only when filled); the WhatsApp number is required and normalised.
            'guest_email' => ['nullable', 'email', 'max:255'],
            'guest_phone' => ['required', 'string', 'max:30', function ($attribute, $value, $fail) {
                if (! Phone::isValid((string) $value)) {
                    $fail(Phone::MESSAGE);
                }
            }],
            // `subject` has no dedicated column on `bookings` — folded onto `notes` in
            // `BookingController::store()`, the same precedent `submitContact()` already uses for
            // `leads.notes` (that table has no `subject` column either).
            'subject' => ['nullable', 'string', 'max:255'],
            'notes' => ['nullable', 'string', 'max:1000'],
            'quote' => ['required', 'array'],
            'quote.service_ids' => ['required', 'array'],
            'quote.deal_id' => ['nullable', 'integer'],
            'quote.code' => ['nullable', 'string'],
            'quote.subtotal' => ['required', 'numeric'],
            'quote.discount' => ['required', 'numeric'],
            'quote.tax' => ['required', 'numeric'],
            'quote.total' => ['required', 'numeric'],
            'quote.expires_at' => ['required', 'integer'],
            'quote.signature' => ['required', 'string'],
        ];
    }
}
