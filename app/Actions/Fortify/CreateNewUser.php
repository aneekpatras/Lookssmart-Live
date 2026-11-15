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
        $input['phone'] = filled($input['phone'] ?? null) ? trim($input['phone']) : null;
        $input['email'] = filled($input['email'] ?? null) ? trim($input['email']) : null;

        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            // At least one of phone or email is required; both must be unique when given.
            'phone' => [
                'nullable', 'string', 'max:30', 'required_without:email',
                function ($attribute, $value, $fail) {
                    if (! filled($value)) {
                        return;
                    }
                    $normalised = Phone::normalize($value);
                    if ($normalised === null) {
                        $fail(Phone::MESSAGE);
                    } elseif (User::where('phone', $normalised)->exists()) {
                        $fail('That number is already registered. Try logging in instead.');
                    }
                },
            ],
            'email' => ['nullable', 'string', 'email', 'max:255', 'required_without:phone', 'unique:users,email'],
            'password' => $this->passwordRules(null, true),
        ], [
            'phone.required_without' => 'Enter your WhatsApp number or your email address.',
            'email.required_without' => 'Enter your WhatsApp number or your email address.',
            'email.unique' => 'That email is already registered. Try logging in instead.',
        ])->validate();

        return DB::transaction(function () use ($input) {
            $user = User::create([
                'name' => $input['name'],
                'email' => $input['email'],
                'phone' => Phone::normalize($input['phone']),
                'password' => Hash::make($input['password']),
            ]);

            CustomerProfile::create(['user_id' => $user->id]);
            $user->assignRole('customer');

            return $user;
        });
    }
}
