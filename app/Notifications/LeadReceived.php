<?php

namespace App\Notifications;

use App\Models\Lead;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/**
 * Auto-reply confirmation to a contact-form sender. Sent via on-demand routing, like `MessageReply`
 * — a contact-form sender isn't necessarily a customer with notification preferences.
 */
class LeadReceived extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Lead $lead) {}

    /** @return array<int, string> */
    public function via(mixed $notifiable): array
    {
        return ['mail'];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject('We received your message — ' . config('app.name'))
            ->view('mail.lead-received', [
                'customer_name' => $this->lead->name,
                'message_body' => $this->lead->notes,
                'title' => 'Thanks for contacting us',
            ]);
    }
}
