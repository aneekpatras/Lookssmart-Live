<?php

namespace App\Notifications;

use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * The admin sign-in email: the 6-digit code and a signed "Approve this sign-in" link. Deliberately NOT queued
 * (shared hosting has no queue worker): it is sent with notifyNow() so a mail failure surfaces immediately.
 */
class AdminSignInCode extends Notification
{
    public function __construct(
        private readonly string $code,
        private readonly string $approveUrl,
        private readonly string $time,
        private readonly string $ip,
        private readonly string $browser,
    ) {}

    /** @return array<int, string> */
    public function via(mixed $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('Your Looks Smart admin sign-in code')
            ->greeting('Admin sign-in')
            ->line('Your sign-in code is:')
            ->line("**{$this->code}**")
            ->line('It expires in 10 minutes and works once. You can also approve the sign-in from the same browser:')
            ->action('Approve this sign-in', $this->approveUrl)
            ->line("Time: {$this->time}")
            ->line("IP address: {$this->ip}")
            ->line("Browser: {$this->browser}")
            ->line('If this was not you, change your password.');
    }
}
