<?php

namespace App\Support;

use App\Models\User;
use Closure;
use Illuminate\Contracts\Validation\ValidationRule;
use Illuminate\Validation\Rules\Password;

/**
 * One source of truth for password rules. Customers: at least 8 characters, one uppercase letter, one
 * number, and not a very common password (local list, no external API). Admin and staff (any user with
 * a non-customer role or a direct permission) keep the stricter 12-character rule.
 *
 * The same constants feed the server rule below and the register page's live checklist
 * (shared to the front-end as `passwordPolicy`), so the two can never disagree.
 */
class PasswordPolicy
{
    public const CUSTOMER_MIN = 8;

    public const STAFF_MIN = 12;

    /** Shared with the front-end checklist (HandleInertiaRequests). */
    public static function forFrontend(): array
    {
        return ['min' => self::CUSTOMER_MIN, 'uppercase' => true, 'number' => true];
    }

    public static function isStaff(?User $user): bool
    {
        if ($user === null) {
            return false;
        }

        return $user->roles->pluck('name')->diff(['customer'])->isNotEmpty()
            || $user->getDirectPermissions()->isNotEmpty();
    }

    /** @return array<int, mixed> */
    public static function rulesFor(?User $user, bool $newCustomer = false): array
    {
        $strict = ! $newCustomer && ($user === null || self::isStaff($user));

        return ['required', 'string', $strict ? Password::min(self::STAFF_MIN)->uncompromised() : self::customerRule(), 'confirmed'];
    }

    public static function customerRule(): ValidationRule
    {
        return new class implements ValidationRule
        {
            public function validate(string $attribute, mixed $value, Closure $fail): void
            {
                $value = (string) $value;

                if (mb_strlen($value) < PasswordPolicy::CUSTOMER_MIN) {
                    $fail('The password must be at least ' . PasswordPolicy::CUSTOMER_MIN . ' characters.');
                } elseif (! preg_match('/\p{Lu}/u', $value)) {
                    $fail('The password must contain at least one uppercase letter.');
                } elseif (! preg_match('/\d/', $value)) {
                    $fail('The password must contain at least one number.');
                } elseif (in_array(mb_strtolower($value), PasswordPolicy::COMMON, true)) {
                    $fail('That password is too common. Please choose a less predictable one.');
                }
            }
        };
    }

    /** About 100 very common passwords, lowercase; compared case-insensitively. Local, never sent anywhere. */
    public const COMMON = [
        '12345678', '123456789', '1234567890', 'password', 'password1', 'password12', 'password123', 'passw0rd',
        'p@ssw0rd', 'p@ssword', 'qwerty123', 'qwertyuiop', 'qwerty12', 'qwertyui', '11111111', '00000000',
        '87654321', '12341234', '123123123', '1q2w3e4r', '1q2w3e4r5t', 'iloveyou', 'iloveyou1', 'welcome1',
        'welcome123', 'admin123', 'admin1234', 'letmein123', 'abc12345', 'abcd1234', 'abcdefgh', 'abcd12345',
        'monkey123', 'dragon123', 'football1', 'baseball1', 'superman1', 'princess1', 'sunshine1', 'shadow123',
        'master123', 'login123', 'trustno1', 'whatever1', 'freedom1', 'michael1', 'jessica1', 'charlie1',
        'ashley123', 'bailey123', 'passw0rd1', 'pakistan1', 'pakistan123', 'lahore123', 'lahore54000',
        'islamabad1', 'karachi123', 'bismillah', 'bismillah1', 'allah12345', 'muhammad1', 'muhammad123',
        'ali123456', 'ahmed123', 'khan12345', 'looksmart1', 'looksmart123', 'smartlooks1', 'salon12345',
        'beauty123', 'beautiful1', 'welcome12', 'changeme1', 'changeme123', 'test1234', 'test12345',
        'testing123', 'guest1234', 'user12345', 'default123', 'secret123', 'summer2024', 'summer2025',
        'winter2024', 'winter2025', 'spring2025', 'january2025', 'password2024', 'password2025',
        'password2026', 'qazwsxedc', 'zaq12wsx', 'asdfghjkl', 'asdf1234', 'zxcvbnm123', '1qaz2wsx',
        'q1w2e3r4', 'a1b2c3d4', '123qweasd', 'pass1234', 'pass12345', 'mypassword', 'mypassword1',
        '123456a', '1234qwer', 'qwer1234', 'letmein1', 'iloveu123', 'loveyou123',
    ];
}
