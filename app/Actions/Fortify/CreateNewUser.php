<?php

namespace App\Actions\Fortify;

use App\Models\CustomerProfile;
use App\Models\User;
use App\Support\Phone;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\CreatesNewUsers;

class CreateNewUser implements CreatesNewUsers
{
    use PasswordValidationRules;

    /**
     * @param array<string, string> $input
     */
    public function create(array $input): User
    {
        // One normalised phone format for the uniqueness check and for storage.
        $phone = Phone::normalize($input['phone'] ?? null);
        $input['phone'] = $phone ?? (filled($input['phone'] ?? null) ? $input['phone'] : null);
        $input['email'] = filled($input['email'] ?? null) ? trim($input['email']) : null;

        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            // At least one of phone or email is required; both must be unique when given.
            'phone' => [
                'nullable', 'string', 'max:30', 'required_without:email', 'unique:users,phone',
                function ($attribute, $value, $fail) {
                    if (filled($value) && ! Phone::isValid($value)) {
                        $fail(Phone::MESSAGE);
                    }
                },
            ],
            'email' => ['nullable', 'string', 'email', 'max:255', 'required_without:phone', 'unique:users,email'],
            'password' => $this->passwordRules(null, true),
        ], [
            'phone.required_without' => 'Enter your WhatsApp number or your email address.',
            'email.required_without' => 'Enter your WhatsApp number or your email address.',
            'phone.unique' => 'That number is already registered. Try logging in instead.',
            'email.unique' => 'That email is already registered. Try logging in instead.',
        ])->validate();

        return DB::transaction(function () use ($input) {
            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'phone' => $input['phone'],
                'password' => Hash::make($input['password']),
            ]);

            CustomerProfile::create(['user_id' => $user->id]);
            $user->assignRole('customer');

            return $user;
        });
    }
}
