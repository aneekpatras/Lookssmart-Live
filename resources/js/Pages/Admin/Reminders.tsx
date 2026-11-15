import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import { ChevronDown, Copy, MessageCircle } from 'lucide-react';
import * as React from 'react';

import { formatWithRelative } from '@/lib/adminFormat';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Textarea } from '@/Components/ui/textarea';
import AdminLayout from '@/Layouts/AdminLayout';

interface Sent {
  at: string | null;
  by: string | null;
}

interface Vars {
  name: string;
  services: string;
  date: string;
  time: string;
}

interface AppointmentRow {
  id: number;
  time: string;
  name: string;
  phone: string | null;
  wa_phone: string | null;
  services: string;
  status: string;
  message: string;
  vars: Vars;
  sent: Sent | null;
}

interface BirthdayRow {
  customer_id: number;
  name: string;
  phone: string | null;
  wa_phone: string | null;
  birthday: string;
  age: number | null;
  days: number;
  opted_out: boolean;
  message: string;
  vars: Vars;
  sent: Sent | null;
}

interface RemindersProps {
  logsReady: boolean;
  range: 'today' | 'tomorrow' | 'week';
  shared: { salon: string; address: string; phone: string };
  templates: {
    reminder: string;
    birthday: string;
    defaults: { reminder: string; birthday: string };
  };
  appointments: AppointmentRow[];
  birthdays: { available: boolean; rows: BirthdayRow[] };
}

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: 'tomorrow', label: 'Tomorrow' },
  { id: 'week', label: 'Next 7 days' },
] as const;

const BIRTHDAY_CHIPS = [
  { id: 'today', label: 'Today', test: (days: number) => days === 0 },
  { id: 'next', label: 'Next 7 days', test: (days: number) => days >= 0 && days <= 7 },
  { id: 'past', label: 'Past 2 days', test: (days: number) => days < 0 },
] as const;

function pill(active: boolean): string {
  return `rounded-full border px-4 py-2 text-sm min-h-10 ${
    active
      ? 'border-ink bg-ink text-ivory'
      : 'border-border-soft text-ink-muted hover:border-accent-500'
  }`;
}

function waUrl(phone: string, message: string): string {
  return `https://wa.me/${phone}?text=${encodeURIComponent(message)}`;
}

function fillPreview(
  template: string,
  vars: Vars | undefined,
  shared: RemindersProps['shared'],
): string {
  const all: Record<string, string> = {
    ...(vars ?? { name: 'Ayesha', services: 'Facial', date: 'Mon 16 Nov', time: '3:00 PM' }),
    ...shared,
  };
  return template.replace(/\{(\w+)\}/g, (match, key: string) => all[key] ?? match);
}

function WhatsAppCell({
  phone,
  message,
  disabledLabel,
  label = 'WhatsApp reminder',
  logBody,
}: {
  phone: string | null;
  message: string;
  disabledLabel?: string;
  label?: string;
  logBody: Record<string, unknown>;
}) {
  const [copied, setCopied] = React.useState(false);

  if (!phone || disabledLabel) {
    return (
      <Button type="button" size="sm" variant="outline" disabled>
        {disabledLabel ?? 'No phone'}
      </Button>
    );
  }

  // The link opens synchronously (so popup blockers allow it); the log request is fire and forget.
  function logClick() {
    axios
      .post('/admin/reminders/log', { ...logBody, phone, message })
      .then(() => router.reload({ only: ['appointments', 'birthdays'] }))
      .catch(() => undefined);
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      <a
        href={waUrl(phone, message)}
        target="_blank"
        rel="noopener noreferrer"
        onClick={logClick}
        className="bg-accent-500 text-ivory hover:bg-accent-600 inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
      >
        <MessageCircle className="size-4" aria-hidden="true" /> {label}
      </a>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        aria-label="Copy message"
        onClick={() => {
          void navigator.clipboard?.writeText(message).then(() => {
            setCopied(true);
            window.setTimeout(() => setCopied(false), 1500);
          });
        }}
      >
        <Copy aria-hidden="true" /> {copied ? 'Copied' : 'Copy message'}
      </Button>
    </div>
  );
}

function SentLabel({ sent }: { sent: Sent | null }) {
  return sent ? (
    <span className="text-emerald-700">
      Sent {formatWithRelative(sent.at)}
      {sent.by ? ` by ${sent.by}` : ''}
    </span>
  ) : (
    <span className="text-ink-muted">Not sent</span>
  );
}

function TemplateEditor({
  label,
  keyName,
  value,
  defaultValue,
  sampleVars,
  shared,
}: {
  label: string;
  keyName: 'reminder' | 'birthday';
  value: string;
  defaultValue: string;
  sampleVars: Vars | undefined;
  shared: RemindersProps['shared'];
}) {
  const [text, setText] = React.useState(value);

  function save(next: string) {
    router.post(
      '/admin/reminders/templates',
      { key: keyName, value: next },
      { preserveScroll: true },
    );
  }

  return (
    <div className="space-y-2">
      <label htmlFor={`template-${keyName}`} className="text-sm font-medium">
        {label}
      </label>
      <Textarea
        id={`template-${keyName}`}
        rows={4}
        maxLength={600}
        value={text}
        onChange={(event) => setText(event.target.value)}
      />
      <p className="text-ink-muted text-xs">
        Placeholders: {'{name}'} {'{services}'} {'{date}'} {'{time}'} {'{salon}'} {'{address}'}{' '}
        {'{phone}'}. Plain text, up to 600 characters ({text.length}).
      </p>
      <p className="bg-accent-50 rounded-md p-3 text-sm">
        <span className="text-ink-muted block text-xs">Preview</span>
        {fillPreview(text, sampleVars, shared)}
      </p>
      <div className="flex gap-2">
        <Button type="button" size="sm" onClick={() => save(text)} disabled={text === value}>
          Save template
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => {
            setText(defaultValue);
            save('');
          }}
        >
          Reset to default
        </Button>
      </div>
    </div>
  );
}

export default function Reminders({
  logsReady,
  range,
  shared,
  templates,
  appointments,
  birthdays,
}: RemindersProps) {
  const [tab, setTab] = React.useState<'appointments' | 'birthdays'>('appointments');
  const [chip, setChip] = React.useState<(typeof BIRTHDAY_CHIPS)[number]['id']>('next');
  const [showTemplates, setShowTemplates] = React.useState(false);

  const chipTest = BIRTHDAY_CHIPS.find((item) => item.id === chip)!.test;
  const birthdayRows = birthdays.rows.filter((row) => chipTest(row.days));

  return (
    <>
      <Head title="Reminders" />
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-ink text-2xl font-medium">Reminders</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Messages are never sent automatically. Press the WhatsApp button, then press send in
            WhatsApp.
          </p>
        </div>

        {!logsReady && (
          <Card>
            <CardContent className="p-4 text-sm">
              The reminders log table has not been created yet. Run the SQL first. Until then the
              buttons still open WhatsApp, but &quot;Sent&quot; is not remembered.
            </CardContent>
          </Card>
        )}

        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              aria-expanded={showTemplates}
              onClick={() => setShowTemplates((open) => !open)}
              className="flex w-full items-center justify-between text-left text-sm font-medium"
            >
              Message templates
              <ChevronDown
                className={`size-4 transition-transform ${showTemplates ? 'rotate-180' : ''}`}
                aria-hidden="true"
              />
            </button>
            {showTemplates && (
              <div className="mt-4 space-y-6">
                <TemplateEditor
                  label="Appointment reminder"
                  keyName="reminder"
                  value={templates.reminder}
                  defaultValue={templates.defaults.reminder}
                  sampleVars={appointments[0]?.vars}
                  shared={shared}
                />
                <TemplateEditor
                  label="Birthday wish"
                  keyName="birthday"
                  value={templates.birthday}
                  defaultValue={templates.defaults.birthday}
                  sampleVars={birthdays.rows[0]?.vars}
                  shared={shared}
                />
              </div>
            )}
          </CardContent>
        </Card>

        <div role="tablist" aria-label="Reminder types" className="flex gap-2">
          {(['appointments', 'birthdays'] as const).map((key) => (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={tab === key}
              onClick={() => setTab(key)}
              className={pill(tab === key)}
            >
              {key === 'appointments' ? 'Appointments' : 'Birthdays'}
            </button>
          ))}
        </div>

        {tab === 'appointments' ? (
          <div className="space-y-4">
            <div role="group" aria-label="Date range" className="flex flex-wrap gap-2">
              {RANGES.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={range === item.id}
                  onClick={() =>
                    router.get('/admin/reminders', { range: item.id }, { preserveState: true })
                  }
                  className={pill(range === item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {appointments.length === 0 ? (
              <p className="text-ink-muted py-10 text-center text-sm">
                No pending or confirmed appointments in this range.
              </p>
            ) : (
              <div className="border-border-soft overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-accent-50 text-ink-muted">
                    <tr>
                      <th className="p-3">Time</th>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Services</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Reminder</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {appointments.map((row) => (
                      <tr key={row.id} className="border-border-soft border-t align-top">
                        <td className="p-3 whitespace-nowrap">{row.time}</td>
                        <td className="p-3">{row.name}</td>
                        <td className="p-3 whitespace-nowrap">{row.phone ?? '—'}</td>
                        <td className="max-w-xs p-3">{row.services || '—'}</td>
                        <td className="p-3">
                          <Badge variant={row.status === 'confirmed' ? 'success' : 'warning'}>
                            {row.status}
                          </Badge>
                        </td>
                        <td className="p-3">
                          <SentLabel sent={row.sent} />
                        </td>
                        <td className="p-3">
                          <WhatsAppCell
                            phone={row.wa_phone}
                            message={row.message}
                            logBody={{ type: 'reminder', booking_id: row.id }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        ) : !birthdays.available ? (
          <p className="text-ink-muted py-10 text-center text-sm">No birthdays are stored yet.</p>
        ) : (
          <div className="space-y-4">
            <div role="group" aria-label="Birthday range" className="flex flex-wrap gap-2">
              {BIRTHDAY_CHIPS.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  aria-pressed={chip === item.id}
                  onClick={() => setChip(item.id)}
                  className={pill(chip === item.id)}
                >
                  {item.label}
                </button>
              ))}
            </div>

            {birthdayRows.length === 0 ? (
              <p className="text-ink-muted py-10 text-center text-sm">
                No birthdays in this range. Birthdays come from the date of birth on customer
                accounts.
              </p>
            ) : (
              <div className="border-border-soft overflow-x-auto rounded-lg border bg-white">
                <table className="w-full text-left text-sm">
                  <thead className="bg-accent-50 text-ink-muted">
                    <tr>
                      <th className="p-3">Customer</th>
                      <th className="p-3">Birthday</th>
                      <th className="p-3">Age</th>
                      <th className="p-3">Phone</th>
                      <th className="p-3">Birthday wish this year</th>
                      <th className="p-3" />
                    </tr>
                  </thead>
                  <tbody>
                    {birthdayRows.map((row) => (
                      <tr key={row.customer_id} className="border-border-soft border-t align-top">
                        <td className="p-3">{row.name}</td>
                        <td className="p-3 whitespace-nowrap">
                          {row.birthday}
                          <span className="text-ink-muted block text-xs">
                            {row.days === 0
                              ? 'Today'
                              : row.days > 0
                                ? `In ${row.days} day${row.days === 1 ? '' : 's'}`
                                : `${-row.days} day${row.days === -1 ? '' : 's'} ago`}
                          </span>
                        </td>
                        <td className="p-3">{row.age ?? '—'}</td>
                        <td className="p-3 whitespace-nowrap">{row.phone ?? '—'}</td>
                        <td className="p-3">
                          <SentLabel sent={row.sent} />
                        </td>
                        <td className="p-3">
                          <WhatsAppCell
                            phone={row.wa_phone}
                            message={row.message}
                            label="Birthday wish"
                            disabledLabel={row.opted_out ? 'Opted out' : undefined}
                            logBody={{ type: 'birthday', customer_id: row.customer_id }}
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}

Reminders.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
