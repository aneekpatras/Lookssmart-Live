import { Head, Link, router, usePage } from '@inertiajs/react';
import * as React from 'react';

import { CancelBookingDialog } from '@/Components/CancelBookingDialog';
import { RescheduleDialog } from '@/Components/RescheduleDialog';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { EmptyState } from '@/Components/ui/empty-state';
import PublicLayout from '@/Layouts/PublicLayout';
import { formatKarachi } from '@/lib/adminFormat';
import { formatCurrency } from '@/lib/currency';

interface Booking {
  id: number;
  code: string;
  status: string;
  starts_at: string | null;
  ends_at: string | null;
  services: string[];
  total: string;
  can_cancel: boolean;
  can_reschedule: boolean;
  reschedule_note: string | null;
  within_cancellation_fee_window: boolean;
}

interface BookingsProps {
  bookings: { data: Booking[]; current_page: number; last_page: number; total: number };
}

const STATUS_VARIANT: Record<string, 'outline' | 'success' | 'destructive'> = {
  confirmed: 'success',
  completed: 'success',
  cancelled: 'destructive',
  no_show: 'destructive',
  pending: 'outline',
  checked_in: 'outline',
};

function statusLabel(status: string): string {
  return status.replace('_', ' ').replace(/\b\w/g, (c) => c.toUpperCase());
}

function BookingCard({ booking }: { booking: Booking }) {
  const [cancelOpen, setCancelOpen] = React.useState(false);
  const [rescheduleOpen, setRescheduleOpen] = React.useState(false);
  const whatsapp = usePage<{ site?: { whatsapp_url?: string } }>().props.site?.whatsapp_url;

  return (
    <Card>
      <CardContent className="flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h3 className="text-lg">{booking.services.join(', ') || 'Appointment'}</h3>
            <Badge variant={STATUS_VARIANT[booking.status] ?? 'outline'}>
              {statusLabel(booking.status)}
            </Badge>
          </div>
          <p className="text-ink-muted mt-2 text-sm">
            {booking.starts_at ? formatKarachi(booking.starts_at, true) : 'Date pending'} ·{' '}
            <span className="font-mono">{booking.code}</span>
          </p>
          <p className="text-ink mt-1 text-sm font-medium">{formatCurrency(booking.total)}</p>
        </div>

        {(booking.can_reschedule || booking.can_cancel) && (
          <div className="flex flex-col items-start gap-2 md:items-end">
            <div className="flex items-center gap-2">
              {booking.can_reschedule && (
                <Button
                  size="sm"
                  variant="outline"
                  className="border-accent-500 text-accent-700 hover:bg-accent-50"
                  onClick={() => setRescheduleOpen(true)}
                >
                  Reschedule
                </Button>
              )}
              {booking.can_cancel && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-ink-muted h-8 px-3 text-xs"
                  onClick={() => setCancelOpen(true)}
                >
                  Cancel
                </Button>
              )}
            </div>
          </div>
        )}
        {!booking.can_reschedule && booking.reschedule_note && (
          <p className="text-ink-muted text-xs md:max-w-60">
            {booking.reschedule_note}{' '}
            {whatsapp && (
              <a href={whatsapp} className="text-accent-700 underline">
                WhatsApp us
              </a>
            )}
          </p>
        )}
      </CardContent>

      {booking.can_reschedule && booking.starts_at && (
        <RescheduleDialog
          open={rescheduleOpen}
          onOpenChange={setRescheduleOpen}
          slotsUrl={`/my-bookings/${booking.code}/slots`}
          rescheduleUrl={`/my-bookings/${booking.code}/reschedule`}
          currentStartsAt={booking.starts_at}
          whatsappUrl={whatsapp}
          onMoved={() => router.reload({ only: ['bookings'] })}
        />
      )}

      {booking.can_cancel && (
        <CancelBookingDialog
          booking={booking}
          open={cancelOpen}
          onOpenChange={setCancelOpen}
          onCancelled={() => router.reload({ only: ['bookings'] })}
        />
      )}
    </Card>
  );
}

export default function Bookings({ bookings }: BookingsProps) {
  const cancelPolicy = usePage<{ site?: { cancel_policy?: string } }>().props.site?.cancel_policy;

  return (
    <>
      <Head title="My Bookings" />

      <div className="mx-auto max-w-4xl space-y-6 px-6 py-16">
        <div>
          <p className="text-accent-700 text-sm font-semibold uppercase tracking-[0.18em]">
            Your appointments
          </p>
          <h1 className="font-display text-ink mt-2 text-4xl font-medium">My Bookings</h1>
          <p className="text-ink-muted mt-3 text-sm">
            {cancelPolicy}
          </p>
        </div>

        <div className="space-y-4">
          {bookings.data.length ? (
            bookings.data.map((booking) => <BookingCard key={booking.id} booking={booking} />)
          ) : (
            <EmptyState
              title="No bookings yet"
              description="Your appointment history will appear here once you book a visit."
            />
          )}
        </div>

        {bookings.last_page > 1 && (
          <div className="flex items-center justify-between">
            <Button
              variant="outline"
              disabled={bookings.current_page === 1}
              onClick={() =>
                router.get('/my-bookings', { page: bookings.current_page - 1 }, { preserveState: true })
              }
            >
              Previous
            </Button>
            <span className="text-ink-muted text-sm">
              Page {bookings.current_page} of {bookings.last_page}
            </span>
            <Button
              variant="outline"
              disabled={bookings.current_page === bookings.last_page}
              onClick={() =>
                router.get('/my-bookings', { page: bookings.current_page + 1 }, { preserveState: true })
              }
            >
              Next
            </Button>
          </div>
        )}

        <div>
          <Link href="/book" className="text-accent-700 text-sm font-semibold hover:underline">
            Book another visit →
          </Link>
        </div>
      </div>
    </>
  );
}

Bookings.layout = (page: React.ReactNode) => <PublicLayout>{page}</PublicLayout>;
