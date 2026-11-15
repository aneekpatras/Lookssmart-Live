<?php

namespace App\Actions\Fortify;

use App\Models\User;
use Illuminate\Contracts\Auth\MustVerifyEmail;
use Illuminate\Support\Facades\Validator;
use Laravel\Fortify\Contracts\UpdatesUserProfileInformation;

class UpdateUserProfileInformation implements UpdatesUserProfileInformation
{
    /**
     * @param array<string, string> $input
     */
    public function update(User $user, array $input): void
    {
        $input['email'] = filled($input['email'] ?? null) ? trim($input['email']) : null;

        Validator::make($input, [
            'name' => ['required', 'string', 'max:255'],
            // Optional for phone accounts, but an account can never end up with neither phone nor email.
            'email' => [
                filled($user->phone) ? 'nullable' : 'required', 'string', 'email', 'max:255',
                'unique:users,email,' . $user->id,
            ],
        ], [
            'email.required' => 'Keep an email or add a WhatsApp number first: an account needs at least one.',
        ])->validate();

        if ($input['email'] !== $user->email && $input['email'] !== null && $user instanceof MustVerifyEmail) {
            $this->updateVerifiedUser($user, $input);

            return;
        }

        $user->forceFill([
            'name' => $input['name'],
            'email' => $input['email'],
        ])->save();
    }

    /**
     * @param array<string, string> $input
     */
    protected function updateVerifiedUser(User $user, array $input): void
    {
        $user->forceFill([
            'name' => $input['name'],
            'email' => $input['email'],
            'email_verified_at' => null,
        ])->save();

        $user->sendEmailVerificationNotification();
    }
}
