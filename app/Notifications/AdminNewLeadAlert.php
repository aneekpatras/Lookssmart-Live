<?php

namespace App\Notifications;

use App\Models\Lead;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Notifications\AnonymousNotifiable;
use Illuminate\Notifications\Messages\MailMessage;
use Illuminate\Notifications\Notification;

/** Admin-facing alert for a new public contact-form lead (counterpart to `NewBookingAdminAlert`). */
class AdminNewLeadAlert extends Notification implements ShouldQueue
{
    use Queueable;

    public function __construct(private readonly Lead $lead) {}

    /** @return array<int, string> */
    public function via(mixed $notifiable): array
    {
        // See NewBookingAdminAlert::via() — the ADMIN_NOTIFICATION_EMAIL fallback routes on-demand
        // to an AnonymousNotifiable, which has no `notifications()` relation.
        if ($notifiable instanceof AnonymousNotifiable) {
            return ['mail'];
        }

        return ['mail', 'database'];
    }

    /** @return array<string, mixed> */
    public function toArray(mixed $notifiable): array
    {
        return [
            'lead_id' => $this->lead->id,
            'message' => "New contact enquiry from {$this->lead->name}.",
        ];
    }

    public function toMail(mixed $notifiable): MailMessage
    {
        return (new MailMessage)
            ->subject("New contact enquiry — {$this->lead->name}")
            ->view('mail.admin-new-lead', [
                'lead_name' => $this->lead->name,
                'lead_email' => $this->lead->email,
                'lead_phone' => $this->lead->phone,
                'lead_notes' => $this->lead->notes,
                'cta_url' => route('admin.leads.show', $this->lead),
            ]);
    }
}
