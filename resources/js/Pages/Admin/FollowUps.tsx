import { Head, router } from '@inertiajs/react';
import axios from 'axios';
import {
  ChevronDown,
  Laptop,
  MapPin,
  MessageCircle,
  Smartphone,
  Tablet,
  Trash2,
} from 'lucide-react';
import * as React from 'react';

import { MessageTemplateEditor } from '@/Components/admin/MessageTemplateEditor';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Switch } from '@/Components/ui/switch';
import AdminLayout from '@/Layouts/AdminLayout';
import { formatKarachi, formatWithRelative } from '@/lib/adminFormat';

interface Row {
  key: string;
  type: 'booking' | 'contact' | 'session';
  id: number;
  session_id: string;
  name: string | null;
  phone: string | null;
  wa_phone: string | null;
  items?: string[];
  total?: string | null;
  email?: string | null;
  subject?: string | null;
  message?: string | null;
  status: string;
  note: string | null;
  last_activity: string | null;
  device: { type: string | null; label: string } | null;
  location: { text: string; approx: boolean } | null;
  source: string | null;
  message_text: string;
  vars: { name: string; services: string; subject: string; message_short: string };
  can_contact: boolean;
}

interface Journey {
  session: {
    first_seen_at: string | null;
    device: string;
    screen: string | null;
    language: string | null;
    timezone: string | null;
    source: string | null;
    landing_path: string | null;
    ip: string | null;
    user_agent: string | null;
    city: string | null;
    region: string | null;
    country: string | null;
  } | null;
  events: { label: string; at: string | null }[];
  pages: { path: string | null; at: string | null }[];
}

interface FollowUpsProps {
  ready: { bookings: boolean; contacts: boolean; sessions: boolean };
  tab: 'bookings' | 'contacts' | 'carts' | 'visitors';
  filters: { range: string; status: string; q: string; bots: boolean };
  rows: Row[];
  hiddenBots: number;
  templates: {
    booking: string;
    contact: string;
    cart: string;
    defaults: { booking: string; contact: string; cart: string };
  };
  geo: { available: boolean };
  ipCheck: { ip: string | null; source: string; private: boolean };
}

const TABS = [
  { id: 'bookings', label: 'Incomplete bookings', needs: 'bookings' },
  { id: 'contacts', label: 'Contact forms', needs: 'contacts' },
  { id: 'carts', label: 'Abandoned carts', needs: 'sessions' },
  { id: 'visitors', label: 'Anonymous visitors', needs: 'sessions' },
] as const;

const RANGES = [
  { id: 'today', label: 'Today' },
  { id: '7', label: '7 days' },
  { id: '30', label: '30 days' },
];

const STATUSES = [
  { id: 'open', label: 'Open (new and contacted)' },
  { id: 'new', label: 'New' },
  { id: 'contacted', label: 'Contacted' },
  { id: 'booked', label: 'Booked' },
  { id: 'not_interested', label: 'Not interested' },
  { id: 'all', label: 'All' },
];

function pill(active: boolean): string {
  return `rounded-full border px-4 py-2 text-sm min-h-10 ${
    active
      ? 'border-ink bg-ink text-ivory'
      : 'border-border-soft text-ink-muted hover:border-accent-500'
  }`;
}

function fillPreview(text: string, vars: Row['vars'] | undefined): string {
  const all: Record<string, string> = {
    name: 'Ayesha',
    services: 'Facial',
    subject: 'Bridal enquiry',
    message_short: 'Do you have a slot on Friday?',
    ...(vars ?? {}),
  };
  return text.replace(/\{(\w+)\}/g, (match, key: string) => all[key] ?? match);
}

function DeviceIcon({ type }: { type: string | null }) {
  const Icon = type === 'mobile' ? Smartphone : type === 'tablet' ? Tablet : Laptop;
  return <Icon className="size-3.5" aria-hidden="true" />;
}

function JourneyPanel({ sessionId }: { sessionId: string }) {
  const [data, setData] = React.useState<Journey | null>(null);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    let cancelled = false;
    axios
      .get<Journey>('/admin/follow-ups/journey', { params: { session_id: sessionId } })
      .then((response) => {
        if (!cancelled) setData(response.data);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [sessionId]);

  if (failed) return <p className="text-sm text-red-600">Could not load the journey.</p>;
  if (!data) return <p className="text-ink-muted text-sm">Loading...</p>;

  const s = data.session;

  return (
    <div className="bg-accent-50 grid gap-4 rounded-lg p-4 text-sm md:grid-cols-2">
      <div>
        <p className="font-medium">Timeline</p>
        {data.events.length === 0 ? (
          <p className="text-ink-muted mt-1">No events recorded.</p>
        ) : (
          <ol className="mt-2 space-y-1">
            {data.events.map((event, index) => (
              <li key={`${event.label}-${index}`} className="flex justify-between gap-3">
                <span>{event.label}</span>
                <span className="text-ink-muted whitespace-nowrap">{formatKarachi(event.at)}</span>
              </li>
            ))}
          </ol>
        )}
        <p className="mt-4 font-medium">Pages viewed (latest 10)</p>
        {data.pages.length === 0 ? (
          <p className="text-ink-muted mt-1">None recorded.</p>
        ) : (
          <ul className="mt-2 space-y-1">
            {data.pages.map((page, index) => (
              <li key={`${page.path}-${index}`} className="flex justify-between gap-3">
                <span className="truncate">{page.path}</span>
                <span className="text-ink-muted whitespace-nowrap">{formatKarachi(page.at)}</span>
              </li>
            ))}
          </ul>
        )}
      </div>
      <div>
        <p className="font-medium">Visitor</p>
        {s ? (
          <dl className="mt-2 space-y-1">
            {[
              ['First seen', formatWithRelative(s.first_seen_at)],
              ['Device', s.device],
              ['Screen', s.screen],
              ['Language', s.language],
              ['Timezone', s.timezone],
              ['Source', s.source],
              ['Landing page', s.landing_path],
              ['IP address', s.ip],
              ['City and region', [s.city, s.region, s.country].filter(Boolean).join(', ')],
              ['User agent', s.user_agent],
            ].map(([label, value]) => (
              <div key={label} className="flex gap-3">
                <dt className="text-ink-muted w-28 shrink-0">{label}</dt>
                <dd className="min-w-0 break-words">{value || '—'}</dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="text-ink-muted mt-1">No session details were recorded for this entry.</p>
        )}
      </div>
    </div>
  );
}

function FollowRow({ row, tab }: { row: Row; tab: FollowUpsProps['tab'] }) {
  const [open, setOpen] = React.useState(false);
  const [expanded, setExpanded] = React.useState(false);
  const [note, setNote] = React.useState(row.note ?? '');
  const anonymous = tab === 'visitors';
  const url = `/admin/follow-ups/${row.type}/${row.id}`;
  const keep = { preserveScroll: true } as const;

  function logContact() {
    axios
      .post(`${url}/contacted`, { phone: row.wa_phone, message: row.message_text })
      .then(() => router.reload({ only: ['rows', 'followUpsNew'] }))
      .catch(() => undefined);
  }

  return (
    <Card>
      <CardContent className="space-y-3 p-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 flex-1 space-y-1">
            <p className="font-medium">
              {anonymous ? 'Anonymous visitor' : (row.name ?? '—')}
              {row.phone && <span className="text-ink-muted ml-2 font-normal">{row.phone}</span>}
            </p>

            {row.type === 'booking' || tab === 'carts' || anonymous ? (
              <p className="text-sm">
                {row.items && row.items.length > 0 ? row.items.join(', ') : '—'}
                {row.total ? (
                  <span className="text-ink-muted">
                    {' '}
                    · Rs. {Number(row.total).toLocaleString()}
                  </span>
                ) : null}
              </p>
            ) : (
              <div className="text-sm">
                <p className="text-ink-muted text-xs">
                  {[row.email, row.subject].filter(Boolean).join(' · ') || 'No email or subject'}
                </p>
                <p className={`mt-1 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}>
                  {row.message || '—'}
                </p>
                {(row.message?.length ?? 0) > 90 && (
                  <button
                    type="button"
                    onClick={() => setExpanded((value) => !value)}
                    className="text-accent-700 text-xs font-medium hover:underline"
                  >
                    {expanded ? 'Show less' : 'Show more'}
                  </button>
                )}
              </div>
            )}

            <p className="text-ink-muted flex flex-wrap items-center gap-x-3 gap-y-1 text-xs">
              {row.device && (
                <span className="inline-flex items-center gap-1">
                  <DeviceIcon type={row.device.type} /> {row.device.label || '—'}
                </span>
              )}
              <span className="inline-flex items-center gap-1">
                <MapPin className="size-3.5" aria-hidden="true" />
                {row.location ? (
                  <span title={row.location.approx ? 'Approximate, based on IP' : undefined}>
                    {row.location.approx ? '~' : ''}
                    {row.location.text}
                  </span>
                ) : (
                  '-'
                )}
              </span>
              <span>Source: {row.source ?? '—'}</span>
              <span>Last activity: {formatWithRelative(row.last_activity)}</span>
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 lg:justify-end">
            {!anonymous && (
              <>
                {row.can_contact ? (
                  <a
                    href={`https://wa.me/${row.wa_phone}?text=${encodeURIComponent(row.message_text)}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    onClick={logContact}
                    className="bg-accent-500 text-ivory hover:bg-accent-600 inline-flex min-h-9 items-center gap-1.5 rounded-md px-3 text-sm font-medium transition-colors"
                  >
                    <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
                  </a>
                ) : (
                  <Button type="button" size="sm" variant="outline" disabled>
                    No phone
                  </Button>
                )}
                <select
                  aria-label="Status"
                  value={row.status}
                  onChange={(event) =>
                    router.patch(`${url}/status`, { status: event.target.value }, keep)
                  }
                  className="border-input bg-background h-9 rounded-md border px-2 text-sm"
                >
                  <option value="new">New</option>
                  <option value="contacted">Contacted</option>
                  <option value="booked">Booked</option>
                  <option value="not_interested">Not interested</option>
                </select>
              </>
            )}
            <Button
              type="button"
              size="icon"
              variant="ghost"
              aria-label="Delete"
              onClick={() => {
                if (confirm('Delete this entry?')) router.delete(url, keep);
              }}
            >
              <Trash2 className="size-4" />
            </Button>
          </div>
        </div>

        {!anonymous && (
          <Input
            aria-label="Note"
            placeholder="Add a note"
            value={note}
            maxLength={1000}
            onChange={(event) => setNote(event.target.value)}
            onBlur={() => {
              if (note !== (row.note ?? '')) router.patch(`${url}/note`, { note }, keep);
            }}
          />
        )}

        <button
          type="button"
          aria-expanded={open}
          onClick={() => setOpen((value) => !value)}
          className="text-ink-muted hover:text-ink inline-flex items-center gap-1 text-xs"
        >
          Journey
          <ChevronDown
            className={`size-3.5 transition-transform ${open ? 'rotate-180' : ''}`}
            aria-hidden="true"
          />
        </button>
        {open && <JourneyPanel sessionId={row.session_id} />}
      </CardContent>
    </Card>
  );
}

export default function FollowUps({
  ready,
  tab,
  filters,
  rows,
  hiddenBots,
  templates,
  geo,
  ipCheck,
}: FollowUpsProps) {
  const [showTemplates, setShowTemplates] = React.useState(false);
  const [search, setSearch] = React.useState(filters.q);

  function go(next: Partial<FollowUpsProps['filters']> & { tab?: string }) {
    router.get(
      '/admin/follow-ups',
      {
        tab: next.tab ?? tab,
        range: next.range ?? filters.range,
        status: next.status ?? filters.status,
        q: (next.q ?? filters.q) || undefined,
        bots: (next.bots ?? filters.bots) ? 1 : undefined,
      },
      { preserveScroll: true, preserveState: true },
    );
  }

  const tabNeeds = TABS.find((item) => item.id === tab)?.needs ?? 'bookings';
  const tabReady = ready[tabNeeds];
  const anonymous = tab === 'visitors';

  const placeholders = ['name', 'services', 'subject', 'message_short'];
  const sample = rows[0]?.vars;

  return (
    <>
      <Head title="Follow-ups" />
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-ink text-2xl font-medium">Follow-ups</h1>
          <p className="text-ink-muted mt-1 text-sm">
            People who started something and did not finish. Messages are never sent automatically:
            press the WhatsApp button, then press send in WhatsApp.
          </p>
        </div>

        {!geo.available && (
          <p className="text-ink-muted text-xs">City lookup is not set up. Optional.</p>
        )}

        <Card>
          <CardContent className="p-4">
            <button
              type="button"
              aria-expanded={showTemplates}
              onClick={() => setShowTemplates((value) => !value)}
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
                {(
                  [
                    ['booking', 'Incomplete booking'],
                    ['cart', 'Abandoned cart'],
                    ['contact', 'Contact form'],
                  ] as const
                ).map(([key, label]) => (
                  <MessageTemplateEditor
                    key={key}
                    id={`template-${key}`}
                    label={label}
                    value={templates[key]}
                    defaultValue={templates.defaults[key]}
                    saveUrl="/admin/follow-ups/templates"
                    payloadKey={key}
                    placeholders={placeholders}
                    preview={(text) => fillPreview(text, sample)}
                  />
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <div role="tablist" aria-label="Follow-up lists" className="flex flex-wrap gap-2">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              onClick={() => go({ tab: item.id })}
              className={pill(tab === item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>

        <div className="flex flex-col gap-3 lg:flex-row lg:items-center">
          <div role="group" aria-label="Date range" className="flex gap-2">
            {RANGES.map((item) => (
              <button
                key={item.id}
                type="button"
                aria-pressed={filters.range === item.id}
                onClick={() => go({ range: item.id })}
                className={pill(filters.range === item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <select
            aria-label="Status filter"
            value={filters.status}
            onChange={(event) => go({ status: event.target.value })}
            className="border-input bg-background h-10 rounded-md border px-3 text-sm"
          >
            {STATUSES.map((item) => (
              <option key={item.id} value={item.id}>
                {item.label}
              </option>
            ))}
          </select>
          {!anonymous && (
            <form
              onSubmit={(event) => {
                event.preventDefault();
                go({ q: search });
              }}
              className="lg:w-64"
            >
              <Input
                aria-label="Search name or phone"
                placeholder="Search name or phone"
                value={search}
                onChange={(event) => setSearch(event.target.value)}
              />
            </form>
          )}
          <label htmlFor="show-bots" className="flex items-center gap-2 text-sm lg:ml-auto">
            <Switch
              checked={filters.bots}
              onCheckedChange={(checked) => go({ bots: checked === true })}
              id="show-bots"
            />
            Show bots
          </label>
        </div>

        {!filters.bots && hiddenBots > 0 && (
          <p className="text-ink-muted text-xs">{hiddenBots} bot visits hidden</p>
        )}

        {!tabReady ? (
          <Card>
            <CardContent className="p-6 text-sm">
              The tracking tables have not been created yet. Run the SQL first.
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <p className="text-ink-muted py-10 text-center text-sm">
            Nothing here for these filters.
          </p>
        ) : (
          <div className="space-y-3">
            {rows.map((row) => (
              <FollowRow key={row.key} row={row} tab={tab} />
            ))}
          </div>
        )}

        <div className="text-ink-muted space-y-1 border-t pt-4 text-xs">
          <p>
            Your IP as the server sees it: {ipCheck.ip ?? 'unknown'} (from {ipCheck.source})
            {ipCheck.private
              ? '. This looks like a private or internal address. On live it should be your real public IP; if not, the server needs TRUSTED_PROXIES set.'
              : ''}
          </p>
          {geo.available && (
            <p>
              City lookup uses GeoLite2 data created by MaxMind, available from
              https://www.maxmind.com
            </p>
          )}
        </div>
      </div>
    </>
  );
}

FollowUps.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
