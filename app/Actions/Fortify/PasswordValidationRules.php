<?php

namespace App\Actions\Fortify;

use App\Models\User;
use App\Support\PasswordPolicy;

trait PasswordValidationRules
{
    /**
     * Customers: 8+ characters, an uppercase letter, a number, not a common password. Staff and admins
     * (and invited users, who always become staff) keep 12+ characters with a breach check.
     * See PasswordPolicy, which the register page's checklist also reads.
     *
     * @return array<int, mixed>
     */
    protected function passwordRules(?User $user = null, bool $newCustomer = false): array
    {
        return PasswordPolicy::rulesFor($user, $newCustomer);
    }
}
