import axios, { isAxiosError } from 'axios';
import * as React from 'react';

import { formatKarachi } from '@/lib/adminFormat';
import { LoadingDots } from '@/Components/LoadingDots';
import { Button } from '@/Components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/Components/ui/dialog';
import { Input } from '@/Components/ui/input';

interface Slot {
  starts_at: string;
  ends_at: string;
  is_available: boolean;
}

interface RescheduleDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** POST endpoint returning { slots } for a { date, timezone } body. */
  slotsUrl: string;
  /** POST endpoint taking { starts_at, timezone }. */
  rescheduleUrl: string;
  currentStartsAt: string;
  /** Called with the new ISO start once the server has moved the booking. */
  onMoved: (startsAt: string) => void;
  whatsappUrl?: string;
}

const TZ = 'Asia/Karachi';

function karachiDate(offsetDays = 0): string {
  const now = new Date(Date.now() + offsetDays * 86_400_000);

  return new Intl.DateTimeFormat('en-CA', { timeZone: TZ }).format(now); // YYYY-MM-DD
}

function period(iso: string): 'Morning' | 'Afternoon' | 'Evening' {
  const hour = Number(
    new Intl.DateTimeFormat('en-GB', { timeZone: TZ, hour: '2-digit', hour12: false }).format(
      new Date(iso),
    ),
  );

  return hour < 12 ? 'Morning' : hour < 17 ? 'Afternoon' : 'Evening';
}

function timeLabel(iso: string): string {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: TZ,
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(new Date(iso));
}

/**
 * Date and time picker for moving a booking: the same native date input and Morning / Afternoon /
 * Evening time chips as the booking page, for the booking's own services, with its current slot
 * counted as free (the server ignores the booking itself). Used from My Bookings and from the signed
 * email page.
 */
export function RescheduleDialog({
  open,
  onOpenChange,
  slotsUrl,
  rescheduleUrl,
  currentStartsAt,
  onMoved,
  whatsappUrl,
}: RescheduleDialogProps) {
  const [date, setDate] = React.useState(karachiDate(1));
  const [slots, setSlots] = React.useState<Slot[]>([]);
  const [chosen, setChosen] = React.useState<string | null>(null);
  const [busy, setBusy] = React.useState(false);
  const [saving, setSaving] = React.useState(false);
  const [error, setError] = React.useState('');
  const requestRef = React.useRef(0);

  const loadSlots = React.useCallback(
    async (forDate: string) => {
      const id = ++requestRef.current;
      setBusy(true);
      setError('');
      setChosen(null);
      try {
        const response = await axios.post(slotsUrl, { date: forDate, timezone: TZ });
        if (id === requestRef.current) setSlots(response.data.slots as Slot[]);
      } catch {
        if (id === requestRef.current) {
          setSlots([]);
          setError('We could not load available times. Please try again.');
        }
      } finally {
        if (id === requestRef.current) setBusy(false);
      }
    },
    [slotsUrl],
  );

  React.useEffect(() => {
    // Loads the day's times whenever the dialog opens or the date changes (a data fetch, not derived state).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (open) void loadSlots(date);
  }, [open, date, loadSlots]);

  const grouped = React.useMemo(() => {
    const groups: Record<'Morning' | 'Afternoon' | 'Evening', Slot[]> = {
      Morning: [],
      Afternoon: [],
      Evening: [],
    };
    for (const slot of slots) groups[period(slot.starts_at)].push(slot);

    return groups;
  }, [slots]);

  async function submit() {
    if (!chosen) return;
    setSaving(true);
    setError('');
    try {
      const response = await axios.post(rescheduleUrl, { starts_at: chosen, timezone: TZ });
      onMoved(response.data.starts_at as string);
      onOpenChange(false);
    } catch (caught) {
      if (isAxiosError(caught)) {
        setError(
          (caught.response?.data as { message?: string } | undefined)?.message ??
            'We could not move your booking. Please try again.',
        );
        if (caught.response?.status === 409) void loadSlots(date);
      } else {
        setError('We could not move your booking. Please try again.');
      }
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Reschedule your booking</DialogTitle>
          <DialogDescription>
            Your current appointment: {formatKarachi(currentStartsAt, true)}
          </DialogDescription>
        </DialogHeader>

        <div>
          <label className="text-sm font-medium" htmlFor="reschedule-date">
            Choose a new date
          </label>
          <Input
            id="reschedule-date"
            type="date"
            min={karachiDate()}
            value={date}
            onChange={(event) => event.target.value && setDate(event.target.value)}
            className="mt-2 max-w-xs"
          />

          <div className="border-border-soft mt-4 max-h-64 space-y-4 overflow-y-auto rounded-lg border p-3">
            {busy && slots.length === 0 && (
              <div className="flex justify-center py-6">
                <LoadingDots label="Loading available times" />
              </div>
            )}
            {(['Morning', 'Afternoon', 'Evening'] as const).map((name) =>
              grouped[name].length > 0 ? (
                <div key={name}>
                  <p className="text-ink-muted text-xs font-semibold tracking-wider uppercase">
                    {name}
                  </p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {grouped[name].map((slot) => {
                      const isChosen = chosen === slot.starts_at;

                      return (
                        <button
                          type="button"
                          key={slot.starts_at}
                          disabled={busy || !slot.is_available}
                          aria-pressed={isChosen}
                          onClick={() => setChosen(slot.starts_at)}
                          className={`rounded-full border px-3.5 py-1.5 text-sm transition-colors ${
                            !slot.is_available
                              ? 'border-border-soft text-ink-muted/50 cursor-not-allowed opacity-50'
                              : `disabled:opacity-50 ${isChosen ? 'border-accent-600 bg-accent-50' : 'border-border-soft hover:border-accent-500'}`
                          }`}
                        >
                          {timeLabel(slot.starts_at)}
                          {!slot.is_available && <span className="ml-1.5 text-xs">· Not Available</span>}
                        </button>
                      );
                    })}
                  </div>
                </div>
              ) : null,
            )}
            {slots.length === 0 && !busy && (
              <p className="text-ink-muted py-4 text-center text-sm">No times found for this date.</p>
            )}
          </div>
        </div>

        {error && (
          <p role="alert" className="text-sm text-red-600">
            {error}
            {whatsappUrl && (
              <>
                {' '}
                <a href={whatsappUrl} className="underline">
                  Message us on WhatsApp
                </a>
              </>
            )}
          </p>
        )}

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Keep my time
          </Button>
          <Button type="button" variant="accent" disabled={!chosen || saving} onClick={() => void submit()}>
            {saving ? 'Moving…' : 'Move my booking'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
