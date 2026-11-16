import { router, useForm } from '@inertiajs/react';
import * as React from 'react';

import { formatWithRelative } from '@/lib/adminFormat';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';

export interface EmailRule {
  id: number;
  name: string;
  event: 'before_booking' | 'review_request';
  amount: number;
  unit: 'minutes' | 'hours' | 'days';
  is_active: boolean;
}

interface EmailRulesTabProps {
  rules: EmailRule[];
  schedulerLastRun: string | null;
  schedulerUrl: string | null;
  mail: { mailer: string; queue: string };
}

const EVENTS = {
  before_booking: { label: 'Booking reminder', when: 'before the appointment' },
  review_request: { label: 'Review request', when: 'after the appointment' },
} as const;

const UNITS = ['minutes', 'hours', 'days'] as const;

const selectClass = 'border-input bg-background h-9 w-full rounded-md border px-3 text-sm';

function offsetLabel(rule: Pick<EmailRule, 'amount' | 'unit' | 'event'>): string {
  const unit = rule.amount === 1 ? rule.unit.slice(0, -1) : rule.unit;

  return `${rule.amount} ${unit} ${EVENTS[rule.event].when}`;
}

function RuleForm({ rule, onDone }: { rule: EmailRule | null; onDone: () => void }) {
  const form = useForm({
    name: rule?.name ?? '',
    event: rule?.event ?? 'before_booking',
    amount: String(rule?.amount ?? 1),
    unit: rule?.unit ?? 'days',
    is_active: rule?.is_active ?? true,
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    const options = { preserveScroll: true, onSuccess: onDone };
    if (rule) {
      form.put(`/admin/reminders/rules/${rule.id}`, options);
    } else {
      form.post('/admin/reminders/rules', options);
    }
  }

  return (
    <form onSubmit={submit} className="border-border-soft space-y-4 rounded-xl border p-4">
      <h3 className="font-display text-ink text-lg font-medium">
        {rule ? 'Edit email rule' : 'New email rule'}
      </h3>
      <div className="grid gap-4 md:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="rule-name">Name</Label>
          <Input
            id="rule-name"
            value={form.data.name}
            maxLength={100}
            onChange={(event) => form.setData('name', event.target.value)}
          />
          {form.errors.name && <p className="text-sm text-red-600">{form.errors.name}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-event">Event</Label>
          <select
            id="rule-event"
            value={form.data.event}
            onChange={(event) =>
              form.setData('event', event.target.value as EmailRule['event'])
            }
            className={selectClass}
          >
            <option value="before_booking">Booking reminder</option>
            <option value="review_request">Review request</option>
          </select>
          {form.errors.event && <p className="text-sm text-red-600">{form.errors.event}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="rule-amount">Timing</Label>
          <div className="flex items-center gap-2">
            <Input
              id="rule-amount"
              type="number"
              min={1}
              className="w-24"
              value={form.data.amount}
              onChange={(event) => form.setData('amount', event.target.value)}
            />
            <select
              aria-label="Unit"
              value={form.data.unit}
              onChange={(event) => form.setData('unit', event.target.value as EmailRule['unit'])}
              className={selectClass + ' w-32'}
            >
              {UNITS.map((unit) => (
                <option key={unit} value={unit}>
                  {unit}
                </option>
              ))}
            </select>
            <span className="text-ink-muted text-sm">{EVENTS[form.data.event].when}</span>
          </div>
          {form.errors.amount && <p className="text-sm text-red-600">{form.errors.amount}</p>}
          {form.data.event === 'before_booking' && (
            <p className="text-ink-muted text-xs">
              Booking reminders can be sent from 30 minutes to 7 days before the appointment.
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label>Channel</Label>
          <p className="border-border-soft bg-ivory h-9 rounded-md border px-3 text-sm leading-9">
            Email
          </p>
        </div>
      </div>
      <div className="flex items-center gap-3">
        <Switch
          id="rule-active"
          checked={form.data.is_active}
          onCheckedChange={(checked) => form.setData('is_active', checked)}
        />
        <Label htmlFor="rule-active">Active</Label>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={form.processing}>
          {rule ? 'Save rule' : 'Create rule'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

export function EmailRulesTab({ rules, schedulerLastRun, schedulerUrl, mail }: EmailRulesTabProps) {
  // `null` = form closed, 'new' = creating, otherwise the rule being edited.
  const [editing, setEditing] = React.useState<EmailRule | 'new' | null>(null);

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="space-y-2 p-5 text-sm">
          <p className="text-ink-muted">
            Email rules run only if the hosting Scheduled Tasks runs php artisan schedule:run every
            minute, and only reach customers who gave an email. Customers with only a phone number
            are not reached; use the WhatsApp tabs for them.
          </p>
          <p className="text-ink">
            <span className="font-medium">Scheduler last ran:</span>{' '}
            {schedulerLastRun ? formatWithRelative(schedulerLastRun) : 'never'}
          </p>
          <div className="border-border-soft space-y-2 rounded-md border p-3">
            <p className="text-ink font-medium">Scheduler URL (for hosts without cron access)</p>
            {schedulerUrl ? (
              <p className="bg-ivory text-ink rounded px-2 py-1 font-mono text-xs break-all select-all">
                {schedulerUrl}
              </p>
            ) : (
              <p className="text-ink-muted">No URL yet. Generate one below.</p>
            )}
            <p className="text-ink-muted text-xs">
              Call this URL every 5 minutes from cron-job.org or the hosting Scheduled Tasks (wget or
              curl). Keep it secret: anyone with it can run the scheduler. Generating a new one
              stops the old one working.
            </p>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => {
                if (!schedulerUrl || confirm('Create a new URL? The current one will stop working.')) {
                  router.post('/admin/reminders/scheduler-token', {}, { preserveScroll: true });
                }
              }}
            >
              {schedulerUrl ? 'Generate a new URL' : 'Generate token'}
            </Button>
          </div>
          <p className="text-ink-muted">
            Mail driver: {mail.mailer || 'not set'} · Queue connection: {mail.queue || 'not set'}
          </p>
          {mail.queue !== 'sync' && (
            <p className="rounded-md border border-amber-300 bg-amber-50 px-3 py-2 text-amber-900">
              QUEUE_CONNECTION is not sync, so queued emails need a queue worker running. This host
              may not have one.
            </p>
          )}
        </CardContent>
      </Card>

      {editing ? (
        <RuleForm
          key={editing === 'new' ? 'new' : editing.id}
          rule={editing === 'new' ? null : editing}
          onDone={() => setEditing(null)}
        />
      ) : (
        <div className="flex flex-wrap gap-2">
          <Button type="button" onClick={() => setEditing('new')}>
            New email rule
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => {
              if (confirm('Create active email reminder rules for 24, 12 and 6 hours before the appointment? Rules that already exist are skipped.')) {
                router.post('/admin/reminders/rules/suggested', {}, { preserveScroll: true });
              }
            }}
          >
            Add suggested rules (24h, 12h, 6h before)
          </Button>
        </div>
      )}

      {rules.length === 0 ? (
        <p className="text-ink-muted text-sm">
          No email rules yet. Nothing is sent until you create one.
        </p>
      ) : (
        <div className="border-border-soft overflow-x-auto rounded-xl border">
          <table className="w-full text-left text-sm">
            <thead className="text-ink-muted border-border-soft border-b text-xs uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Event</th>
                <th className="px-4 py-3">Timing</th>
                <th className="px-4 py-3">Channel</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((rule) => (
                <tr key={rule.id} className="border-border-soft border-b last:border-0">
                  <td className="text-ink px-4 py-3 font-medium">{rule.name || '—'}</td>
                  <td className="px-4 py-3">{EVENTS[rule.event].label}</td>
                  <td className="px-4 py-3">{offsetLabel(rule)}</td>
                  <td className="px-4 py-3">Email</td>
                  <td className="px-4 py-3">
                    <Badge variant={rule.is_active ? 'success' : 'outline'}>
                      {rule.is_active ? 'Active' : 'Off'}
                    </Badge>
                  </td>
                  <td className="space-x-2 px-4 py-3 text-right">
                    <Button type="button" size="sm" variant="outline" onClick={() => setEditing(rule)}>
                      Edit
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        if (confirm(`Delete the rule "${rule.name}"?`)) {
                          router.delete(`/admin/reminders/rules/${rule.id}`, { preserveScroll: true });
                        }
                      }}
                    >
                      Delete
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
