<?php

namespace App\Support;

use App\Models\User;
use Illuminate\Support\Facades\URL;

class NotificationPreferenceService
{
    public static function optedOut(mixed $notifiable, string $channel): bool
    {
        $profile = $notifiable instanceof User ? $notifiable->customerProfile : null;

        return match ($channel) {
            'mail' => (bool) $profile?->email_opt_out,
            'sms' => (bool) $profile?->sms_opt_out,
            'whatsapp' => (bool) $profile?->whatsapp_opt_out,
            default => false,
        };
    }

    /** Signed opt-out link. The opt-out is stored on the account's profile, so only accounts get one. */
    public static function unsubscribeUrl(mixed $user, string $channel): ?string
    {
        if (! $user instanceof User) {
            return null;
        }

        return URL::temporarySignedRoute(
            'notifications.unsubscribe',
            now()->addDays(30),
            ['user' => $user->getKey(), 'channel' => $channel],
        );
    }
}
