import { Head } from '@inertiajs/react';
import axios, { isAxiosError } from 'axios';
import { CircleAlert } from 'lucide-react';
import * as React from 'react';

import { RescheduleDialog } from '@/Components/RescheduleDialog';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import PublicLayout from '@/Layouts/PublicLayout';
import { formatKarachi } from '@/lib/adminFormat';

interface BookingLinkProps {
  invalid: boolean;
  whatsapp: string;
  booking?: {
    code: string;
    status: string;
    starts_at: string;
    ends_at: string;
    services: string[];
    total: string;
    can_confirm: boolean;
    reschedule_blocked: string | null;
  };
  urls?: { confirm: string; slots: string; reschedule: string };
}

function statusLabel(status: string): string {
  return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

export default function BookingLink({ invalid, whatsapp, booking, urls }: BookingLinkProps) {
  const [status, setStatus] = React.useState(booking?.status ?? '');
  const [startsAt, setStartsAt] = React.useState(booking?.starts_at ?? '');
  const [message, setMessage] = React.useState('');
  const [error, setError] = React.useState('');
  const [busy, setBusy] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(
    typeof window !== 'undefined' && window.location.hash === '#reschedule',
  );

  if (invalid || !booking || !urls) {
    return (
      <>
        <Head title="Booking link" />
        <section className="px-6 py-24">
          <div className="mx-auto max-w-lg text-center">
            <CircleAlert className="text-accent-700 mx-auto size-10" aria-hidden="true" />
            <h1 className="font-display text-ink mt-4 text-3xl font-medium">This link has expired</h1>
            <p className="text-ink-muted mt-3">
              This booking link is no longer valid, or the appointment has passed. Message us on
              WhatsApp and we will help.
            </p>
            <Button asChild variant="accent" className="mt-6">
              <a href={whatsapp}>Message us on WhatsApp</a>
            </Button>
          </div>
        </section>
      </>
    );
  }

  const pending = status === 'pending';
  const canReschedule =
    (status === 'pending' || status === 'confirmed') && !booking.reschedule_blocked;

  async function confirm() {
    if (!urls) return;
    setBusy(true);
    setError('');
    try {
      const response = await axios.post(urls.confirm);
      setStatus(response.data.status as string);
      setMessage(response.data.message as string);
    } catch (caught) {
      setError(
        isAxiosError(caught)
          ? ((caught.response?.data as { message?: string } | undefined)?.message ??
              'We could not confirm your booking. Please try again.')
          : 'We could not confirm your booking. Please try again.',
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <Head title="Your booking" />
      <section className="px-6 py-16">
        <div className="mx-auto max-w-lg space-y-6">
          <div>
            <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">
              Your appointment
            </p>
            <h1 className="font-display text-ink mt-2 text-3xl font-medium">Booking {booking.code}</h1>
          </div>

          <Card>
            <CardContent className="space-y-2 p-5 text-sm">
              <p>
                <span className="text-ink-muted">Status:</span>{' '}
                <span className="text-ink font-medium">{statusLabel(status)}</span>
              </p>
              <p>
                <span className="text-ink-muted">When:</span>{' '}
                <span className="text-ink font-medium">{formatKarachi(startsAt, true)}</span>
              </p>
              <p>
                <span className="text-ink-muted">Services:</span>{' '}
                <span className="text-ink font-medium">{booking.services.join(', ') || 'Appointment'}</span>
              </p>
              <p>
                <span className="text-ink-muted">Total:</span>{' '}
                <span className="text-ink font-medium">{booking.total}</span>
              </p>
            </CardContent>
          </Card>

          {message && (
            <p role="status" className="rounded-lg border border-emerald-300 bg-emerald-50 p-4 text-sm text-emerald-900">
              {message}
            </p>
          )}
          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <div className="flex flex-wrap gap-3">
            {pending && booking.can_confirm && (
              <Button type="button" variant="accent" size="lg" disabled={busy} onClick={() => void confirm()}>
                {busy ? 'Confirming…' : 'Confirm my booking'}
              </Button>
            )}
            {canReschedule && (
              <Button type="button" variant="outline" size="lg" onClick={() => setRescheduleOpen(true)}>
                Reschedule
              </Button>
            )}
          </div>
          {booking.reschedule_blocked && (status === 'pending' || status === 'confirmed') && (
            <p className="text-ink-muted text-sm">
              {booking.reschedule_blocked}{' '}
              <a href={whatsapp} className="text-accent-700 underline">
                WhatsApp us
              </a>
            </p>
          )}
        </div>
      </section>

      <RescheduleDialog
        open={rescheduleOpen}
        onOpenChange={setRescheduleOpen}
        slotsUrl={urls.slots}
        rescheduleUrl={urls.reschedule}
        currentStartsAt={startsAt}
        whatsappUrl={whatsapp}
        onMoved={(next) => {
          setStartsAt(next);
          setMessage('Your booking has been moved. We will see you then.');
        }}
      />
    </>
  );
}

BookingLink.layout = (page: React.ReactNode) => <PublicLayout>{page}</PublicLayout>;
