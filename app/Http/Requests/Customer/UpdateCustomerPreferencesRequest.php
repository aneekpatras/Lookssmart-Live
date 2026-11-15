<?php

namespace App\Http\Requests\Customer;

use App\Http\Requests\BaseFormRequest;

class UpdateCustomerPreferencesRequest extends BaseFormRequest
{
    public function authorize(): bool
    {
        return $this->user() !== null;
    }

    protected function prepareForValidation(): void
    {
        $normalised = \App\Support\Phone::normalize((string) $this->input('phone'));
        $this->merge(['phone' => $normalised ?? ($this->filled('phone') ? $this->input('phone') : null)]);
    }

    public function rules(): array
    {
        return [
            // Valid, unique, and required when the account has no email (never leave an account with neither).
            'phone' => [
                $this->user()?->email ? 'nullable' : 'required', 'string', 'max:30',
                \Illuminate\Validation\Rule::unique('users', 'phone')->ignore($this->user()?->id),
                function ($attribute, $value, $fail) {
                    if (filled($value) && ! \App\Support\Phone::isValid($value)) {
                        $fail(\App\Support\Phone::MESSAGE);
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
