<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\BaseFormRequest;

class UpdateCustomerPreferencesRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    public function rules(): array
    {
        return [
            // Valid, unique, and required when the account has no email (never leave an account with neither).
            'phone' => [
                $this->user()?->email ? 'nullable' : 'required', 'string', 'max:30',
                function ($attribute, $value, $fail) {
                    if (! filled($value)) {
                        return;
                    }
                    $normalised = \App\Support\Phone::normalize($value);
                    if ($normalised === null) {
                        $fail(\App\Support\Phone::MESSAGE);
                    } elseif (\App\Models\User::where('phone', $normalised)->where('id', '!=', $this->user()?->id)->exists()) {
                        $fail('That number is already used by another account.');
                    }
                },
            ],
            'marketing_opt_in' => ['boolean'],
            'email_opt_out' => ['boolean'],
            'sms_opt_out' => ['boolean'],
            'whatsapp_opt_out' => ['boolean'],
        ];
    }
}
