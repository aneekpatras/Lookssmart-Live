import { Head, router } from '@inertiajs/react';
import * as React from 'react';

import { formatWithRelative } from '@/lib/adminFormat';
import { Badge } from '@/Components/ui/badge';
import { Card, CardContent } from '@/Components/ui/card';
import AdminLayout from '@/Layouts/AdminLayout';

interface EventRow {
  id: number;
  type: string;
  ip: string | null;
  subject: string | null;
  user_id: number | null;
  user_agent: string | null;
  created_at: string | null;
}

interface SecurityLogProps {
  ready: boolean;
  types: string[];
  type: string | null;
  topIps: { ip: string; failed_logins: number; spam_hits: number; lockouts: number }[];
  events: EventRow[];
}

const BAD = ['login_failed', 'lockout', 'form_spam'];

export default function SecurityLog({ ready, types, type, topIps, events }: SecurityLogProps) {
  return (
    <>
      <Head title="Security log" />
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-ink text-2xl font-medium">Security log</h1>
          <p className="text-ink-muted mt-1 text-sm">
            Sign-ins, lockouts, new accounts, password resets and blocked spam. Emails are masked
            and passwords are never stored. Entries older than 90 days are removed automatically.
          </p>
        </div>

        {!ready ? (
          <Card>
            <CardContent className="p-6 text-sm">
              The security log table has not been created yet. Run the SQL first.
            </CardContent>
          </Card>
        ) : (
          <>
            <div>
              <h2 className="font-display text-ink text-lg font-medium">Top IPs, last 24 hours</h2>
              {topIps.length === 0 ? (
                <p className="text-ink-muted mt-2 text-sm">
                  No failed logins or spam in the last 24 hours.
                </p>
              ) : (
                <div className="border-border-soft mt-3 overflow-x-auto rounded-lg border bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-accent-50 text-ink-muted">
                      <tr>
                        <th className="p-3">IP</th>
                        <th className="p-3">Failed logins</th>
                        <th className="p-3">Lockouts</th>
                        <th className="p-3">Spam hits</th>
                      </tr>
                    </thead>
                    <tbody>
                      {topIps.map((row) => (
                        <tr key={row.ip} className="border-border-soft border-t">
                          <td className="p-3">{row.ip}</td>
                          <td className="p-3">{row.failed_logins}</td>
                          <td className="p-3">{row.lockouts}</td>
                          <td className="p-3">{row.spam_hits}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            <div className="space-y-3">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-display text-ink text-lg font-medium">Recent events</h2>
                <select
                  aria-label="Filter by type"
                  value={type ?? ''}
                  onChange={(event) =>
                    router.get(
                      '/admin/security-log',
                      { type: event.target.value || undefined },
                      { preserveState: true },
                    )
                  }
                  className="border-input bg-background h-9 rounded-md border px-3 text-sm"
                >
                  <option value="">All types</option>
                  {types.map((value) => (
                    <option key={value} value={value}>
                      {value.replace('_', ' ')}
                    </option>
                  ))}
                </select>
              </div>
              {events.length === 0 ? (
                <p className="text-ink-muted py-8 text-center text-sm">No events yet.</p>
              ) : (
                <div className="border-border-soft overflow-x-auto rounded-lg border bg-white">
                  <table className="w-full text-left text-sm">
                    <thead className="bg-accent-50 text-ink-muted">
                      <tr>
                        <th className="p-3">When</th>
                        <th className="p-3">Type</th>
                        <th className="p-3">IP</th>
                        <th className="p-3">Account</th>
                        <th className="p-3">Browser</th>
                      </tr>
                    </thead>
                    <tbody>
                      {events.map((event) => (
                        <tr key={event.id} className="border-border-soft border-t align-top">
                          <td className="p-3 whitespace-nowrap">
                            {formatWithRelative(event.created_at)}
                          </td>
                          <td className="p-3">
                            <Badge variant={BAD.includes(event.type) ? 'destructive' : 'outline'}>
                              {event.type.replace('_', ' ')}
                            </Badge>
                          </td>
                          <td className="p-3">{event.ip ?? '—'}</td>
                          <td className="p-3">{event.subject ?? '—'}</td>
                          <td
                            className="text-ink-muted max-w-xs truncate p-3"
                            title={event.user_agent ?? ''}
                          >
                            {event.user_agent ?? '—'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

SecurityLog.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
