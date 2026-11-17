import { Head, router, useForm } from '@inertiajs/react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Textarea } from '@/Components/ui/textarea';
import AdminLayout from '@/Layouts/AdminLayout';
import { cn } from '@/lib/utils';

const MASK = '••••••••';

type SettingValue = string | number | boolean | null;

interface SettingsGroups {
  business: Record<string, SettingValue>;
  booking: Record<string, SettingValue>;
  payments: Record<string, SettingValue>;
  integrations: Record<string, SettingValue>;
  seo: Record<string, SettingValue>;
  deals_bar: Record<string, SettingValue>;
  wa_popup: Record<string, SettingValue>;
  analytics: Record<string, SettingValue>;
  security: Record<string, SettingValue>;
  hero: Record<string, SettingValue>;
  theme: Record<string, SettingValue>;
}

interface BusinessHourRow {
  weekday: number;
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

interface SettingsIndexPageProps {
  settings: SettingsGroups;
  businessHours: BusinessHourRow[];
  dealOptions: { id: number; title: string }[];
  heroMedia: HeroMediaInfo;
}

interface HeroMediaInfo {
  videos: string[];
  posters: string[];
  limits: { upload_max_filesize: number; post_max_size: number };
  defaultVideo: string;
  defaultPoster: string;
}

const TABS = [
  { id: 'general', label: 'General' },
  { id: 'hours', label: 'Business Hours' },
  { id: 'booking', label: 'Booking Rules' },
  { id: 'payments', label: 'Payments & Taxes' },
  { id: 'integrations', label: 'Integrations' },
  { id: 'deals-bar', label: 'Deals Bar' },
  { id: 'wa-popup', label: 'WhatsApp popup' },
  { id: 'hero', label: 'Home hero' },
  { id: 'theme', label: 'Theme colours' },
  { id: 'analytics', label: 'Analytics' },
  { id: 'seo-security', label: 'SEO & Security' },
] as const;

type TabId = (typeof TABS)[number]['id'];

function TextField({
  id,
  label,
  value,
  onChange,
  error,
  placeholder,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  placeholder?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} value={value} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} aria-invalid={!!error} />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function SecretField({
  id,
  label,
  value,
  onChange,
  isSet,
  error,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  isSet: boolean;
  error?: string;
}) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id} className="flex items-center gap-2">
        {label}
        {isSet && <span className="text-ink-muted text-xs font-normal">(currently set)</span>}
      </Label>
      <Input
        id={id}
        type="password"
        autoComplete="off"
        value={value}
        placeholder={isSet ? 'Leave blank to keep current value' : 'Not set'}
        onChange={(e) => onChange(e.target.value)}
        aria-invalid={!!error}
      />
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ToggleField({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label htmlFor={id} className="flex items-center gap-2">
      <Switch id={id} checked={checked} onCheckedChange={(value) => onChange(value === true)} />
      <span className="text-sm">{label}</span>
    </label>
  );
}

function GroupForm({
  group,
  title,
  description,
  fields,
  children,
}: {
  group: string;
  title: string;
  description?: string;
  fields: Record<string, string>;
  children: (data: Record<string, string>, setField: (key: string, value: string) => void, fieldError: (key: string) => string | undefined) => React.ReactNode;
}) {
  const { data, setData, transform, put, processing, errors } = useForm<Record<string, string>>(fields);

  // useForm keeps its first values forever. When the server's values change (after a save, or after the hero
  // upload endpoint selected a new file) load them into the form, so a later Save can never write an old value
  // back. Unsaved edits are untouched: the props only change when the server's stored values do.
  const serverValues = JSON.stringify(fields);
  const syncedValues = React.useRef(serverValues);
  React.useEffect(() => {
    if (syncedValues.current === serverValues) return;
    syncedValues.current = serverValues;
    setData(JSON.parse(serverValues) as Record<string, string>);
  }, [serverValues, setData]);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    transform((current) => ({
      settings: Object.fromEntries(Object.entries(current).map(([key, value]) => [`${group}.${key}`, value])),
    }));
    put(`/admin/settings/${group}`, {
      preserveScroll: true,
      onSuccess: () => toast.success('Settings saved — cache cleared.'),
    });
  }

  function fieldError(key: string): string | undefined {
    return errors[`settings.${group}.${key}` as keyof typeof errors];
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div>
          <h2 className="font-display text-ink text-lg font-medium">{title}</h2>
          {description && <p className="text-ink-muted text-sm">{description}</p>}
        </div>
        <form onSubmit={submit} className="space-y-4">
          {children(data, (key, value) => setData(key, value), fieldError)}
          <Button type="submit" disabled={processing}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function toFieldValue(value: SettingValue | undefined): string {
  if (value === null || value === undefined) return '';
  return String(value);
}

function GeneralTab({ business }: { business: Record<string, SettingValue> }) {
  const logoForm = useForm<{ logo: File | null }>({ logo: null });
  const faviconForm = useForm<{ favicon: File | null }>({ favicon: null });

  function uploadLogo(file: File) {
    logoForm.setData('logo', file);
    logoForm.post('/admin/settings/business/logo', {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => toast.success('Logo updated.'),
    });
  }

  function uploadFavicon(file: File) {
    faviconForm.setData('favicon', file);
    faviconForm.post('/admin/settings/business/favicon', {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => toast.success('Favicon updated.'),
    });
  }

  return (
    <div className="space-y-6">
      <GroupForm
        group="business"
        title="Business Info"
        fields={{
          name: toFieldValue(business['business.name']),
          phone: toFieldValue(business['business.phone']),
          email: toFieldValue(business['business.email']),
          address: toFieldValue(business['business.address']),
          currency: toFieldValue(business['business.currency']),
          timezone: toFieldValue(business['business.timezone']),
          social_facebook: toFieldValue(business['business.social_facebook']),
          social_instagram: toFieldValue(business['business.social_instagram']),
          latitude: toFieldValue(business['business.latitude']),
          longitude: toFieldValue(business['business.longitude']),
        }}
      >
        {(data, setField, fieldError) => (
          <>
            <TextField id="business.name" label="Business name" value={data.name ?? ''} onChange={(v) => setField('name', v)} error={fieldError('name')} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField id="business.phone" label="Phone" value={data.phone ?? ''} onChange={(v) => setField('phone', v)} error={fieldError('phone')} />
              <TextField id="business.email" label="Email" value={data.email ?? ''} onChange={(v) => setField('email', v)} error={fieldError('email')} />
            </div>
            <TextField id="business.address" label="Address" value={data.address ?? ''} onChange={(v) => setField('address', v)} error={fieldError('address')} />
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField id="business.currency" label="Currency" value={data.currency ?? ''} onChange={(v) => setField('currency', v)} error={fieldError('currency')} />
              <TextField id="business.timezone" label="Timezone" value={data.timezone ?? ''} onChange={(v) => setField('timezone', v)} error={fieldError('timezone')} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField id="business.social_facebook" label="Facebook URL" value={data.social_facebook ?? ''} onChange={(v) => setField('social_facebook', v)} />
              <TextField id="business.social_instagram" label="Instagram URL" value={data.social_instagram ?? ''} onChange={(v) => setField('social_instagram', v)} />
            </div>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
              <TextField id="business.latitude" label="Latitude (optional, for map SEO)" value={data.latitude ?? ''} onChange={(v) => setField('latitude', v)} error={fieldError('latitude')} />
              <TextField id="business.longitude" label="Longitude (optional, for map SEO)" value={data.longitude ?? ''} onChange={(v) => setField('longitude', v)} error={fieldError('longitude')} />
            </div>
          </>
        )}
      </GroupForm>

      <Card>
        <CardContent className="space-y-5 p-6">
          <h2 className="font-display text-ink text-lg font-medium">Branding</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="logo">Logo</Label>
              {business['business.logo_path'] && typeof business['business.logo_path'] === 'string' && (
                <img src={business['business.logo_path']} alt="" className="mb-2 h-12 object-contain" />
              )}
              <Input
                id="logo"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadLogo(file);
                }}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="favicon">Favicon</Label>
              {business['business.favicon_path'] && typeof business['business.favicon_path'] === 'string' && (
                <img src={business['business.favicon_path']} alt="" className="mb-2 h-8 w-8 object-contain" />
              )}
              <Input
                id="favicon"
                type="file"
                accept="image/jpeg,image/png,image/webp,image/gif"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) uploadFavicon(file);
                }}
              />
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function HoursTab({ businessHours }: { businessHours: BusinessHourRow[] }) {
  const WEEKDAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  const { data, setData, put, processing } = useForm<{ hours: BusinessHourRow[] }>({
    hours: WEEKDAY_NAMES.map((_, weekday) => businessHours.find((h) => h.weekday === weekday) ?? {
      weekday,
      open_time: '09:00',
      close_time: '19:00',
      is_closed: false,
    }),
  });

  function updateRow(weekday: number, patch: Partial<BusinessHourRow>) {
    setData(
      'hours',
      data.hours.map((row) => (row.weekday === weekday ? { ...row, ...patch } : row)),
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    put('/admin/settings/hours', {
      preserveScroll: true,
      onSuccess: () => toast.success('Operating hours saved — cache cleared.'),
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <h2 className="font-display text-ink text-lg font-medium">Operating Hours</h2>
        <form onSubmit={submit} className="space-y-3">
          {data.hours.map((row) => (
            <div key={row.weekday} className="grid grid-cols-[100px_1fr_1fr_auto] items-center gap-3">
              <span className="text-sm font-medium">{WEEKDAY_NAMES[row.weekday]}</span>
              <Input
                type="time"
                aria-label={`${WEEKDAY_NAMES[row.weekday]} opening time`}
                value={row.open_time ?? ''}
                disabled={row.is_closed}
                onChange={(e) => updateRow(row.weekday, { open_time: e.target.value })}
              />
              <Input
                type="time"
                aria-label={`${WEEKDAY_NAMES[row.weekday]} closing time`}
                value={row.close_time ?? ''}
                disabled={row.is_closed}
                onChange={(e) => updateRow(row.weekday, { close_time: e.target.value })}
              />
              <div className="flex items-center gap-2 text-sm whitespace-nowrap">
                <Switch
                  checked={row.is_closed}
                  onCheckedChange={(checked) => updateRow(row.weekday, { is_closed: checked === true })}
                  aria-label={`${WEEKDAY_NAMES[row.weekday]} closed`}
                />
                <span>Closed</span>
              </div>
            </div>
          ))}
          <Button type="submit" disabled={processing}>
            Save hours
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function BookingTab({ booking }: { booking: Record<string, SettingValue> }) {
  return (
    <GroupForm
      group="booking"
      title="Booking Rules & Policies"
      fields={{
        slot_minutes: toFieldValue(booking['booking.slot_minutes']),
        max_advance_days: toFieldValue(booking['booking.max_advance_days']),
        hold_minutes: toFieldValue(booking['booking.hold_minutes']),
        min_lead_minutes: toFieldValue(booking['booking.min_lead_minutes']),
        cancellation_window_hours: toFieldValue(booking['booking.cancellation_window_hours']),
        cancel_policy_text: toFieldValue(booking['booking.cancel_policy_text']),
        reschedule_min_hours: toFieldValue(booking['booking.reschedule_min_hours']),
        tax_rate: toFieldValue(booking['booking.tax_rate']),
        max_bookings_per_slot: toFieldValue(booking['booking.max_bookings_per_slot']),
      }}
    >
      {(data, setField) => (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <TextField id="booking.slot_minutes" label="Slot size (minutes)" value={data.slot_minutes ?? ''} onChange={(v) => setField('slot_minutes', v)} />
          <TextField id="booking.max_bookings_per_slot" label="Max bookings per slot" value={data.max_bookings_per_slot ?? ''} onChange={(v) => setField('max_bookings_per_slot', v)} />
          <TextField id="booking.max_advance_days" label="Max advance booking (days)" value={data.max_advance_days ?? ''} onChange={(v) => setField('max_advance_days', v)} />
          <TextField id="booking.hold_minutes" label="Slot hold (minutes)" value={data.hold_minutes ?? ''} onChange={(v) => setField('hold_minutes', v)} />
          <TextField id="booking.min_lead_minutes" label="Minimum lead time (minutes)" value={data.min_lead_minutes ?? ''} onChange={(v) => setField('min_lead_minutes', v)} />
          <TextField id="booking.cancellation_window_hours" label="Cancellation window (hours)" value={data.cancellation_window_hours ?? ''} onChange={(v) => setField('cancellation_window_hours', v)} />
          <TextField id="booking.reschedule_min_hours" label="Customers can reschedule up to (hours before the start; 0 = no limit)" value={data.reschedule_min_hours ?? ''} onChange={(v) => setField('reschedule_min_hours', v)} placeholder="0" />
          <div className="space-y-1.5 sm:col-span-2">
            <TextField id="booking.cancel_policy_text" label="Cancellation text shown to customers (max 300 characters)" value={data.cancel_policy_text ?? ''} onChange={(v) => setField('cancel_policy_text', v.slice(0, 300))} placeholder="Need to change or cancel? Message us on WhatsApp and we will help." />
            <p className="text-ink-muted text-xs">Plain text. Shown on My Bookings and in the cancel window. Leave empty for the default. Only write a fee or deadline here if the salon really has one.</p>
          </div>
          <TextField id="booking.tax_rate" label="Tax rate (%)" value={data.tax_rate ?? ''} onChange={(v) => setField('tax_rate', v)} />
        </div>
      )}
    </GroupForm>
  );
}

function PaymentsTab({ payments }: { payments: Record<string, SettingValue> }) {
  const { data, setData, transform, put, processing, reset } = useForm<Record<string, string | boolean>>({
    cash_enabled: payments['payments.cash_enabled'] === true,
    card_enabled: payments['payments.card_enabled'] === true,
    stripe_public_key: toFieldValue(payments['payments.stripe_public_key']),
    stripe_secret_key: '',
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    transform((current) => ({
      settings: Object.fromEntries(Object.entries(current).map(([key, value]) => [`payments.${key}`, value])),
    }));
    put('/admin/settings/payments', {
      preserveScroll: true,
      onSuccess: () => {
        toast.success('Settings saved — cache cleared.');
        reset('stripe_secret_key');
      },
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div>
          <h2 className="font-display text-ink text-lg font-medium">Payments</h2>
          <p className="text-ink-muted text-sm">
            Tax rate is managed on the Booking Rules tab. These payment fields are not yet connected
            to a live payment processor (built in Phase 12).
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <ToggleField id="cash_enabled" label="Accept cash" checked={data.cash_enabled === true} onChange={(v) => setData('cash_enabled', v)} />
          <ToggleField id="card_enabled" label="Accept card" checked={data.card_enabled === true} onChange={(v) => setData('card_enabled', v)} />
          <TextField
            id="stripe_public_key"
            label="Stripe publishable key"
            value={String(data.stripe_public_key ?? '')}
            onChange={(v) => setData('stripe_public_key', v)}
          />
          <SecretField
            id="stripe_secret_key"
            label="Stripe secret key"
            value={String(data.stripe_secret_key ?? '')}
            onChange={(v) => setData('stripe_secret_key', v)}
            isSet={payments['payments.stripe_secret_key'] === MASK}
          />
          <Button type="submit" disabled={processing}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function IntegrationsTab({ integrations }: { integrations: Record<string, SettingValue> }) {
  const { data, setData, transform, put, processing, reset } = useForm<Record<string, string>>({
    twilio_sid: '',
    twilio_auth_token: '',
    twilio_sms_from: toFieldValue(integrations['integrations.twilio_sms_from']),
    twilio_whatsapp_from: toFieldValue(integrations['integrations.twilio_whatsapp_from']),
    google_maps_api_key: '',
    google_analytics_id: toFieldValue(integrations['integrations.google_analytics_id']),
    google_tag_manager_id: toFieldValue(integrations['integrations.google_tag_manager_id']),
    google_site_verification: toFieldValue(integrations['integrations.google_site_verification']),
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    transform((current) => ({
      settings: Object.fromEntries(Object.entries(current).map(([key, value]) => [`integrations.${key}`, value])),
    }));
    put('/admin/settings/integrations', {
      preserveScroll: true,
      onSuccess: () => {
        toast.success('Settings saved — cache cleared.');
        reset('twilio_sid', 'twilio_auth_token', 'google_maps_api_key');
      },
    });
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div>
          <h2 className="font-display text-ink text-lg font-medium">Integrations</h2>
          <p className="text-ink-muted text-sm">
            Search Console verification is live on every public page as soon as it&rsquo;s saved here
            (Google Analytics and Tag Manager now live in the Analytics tab). Mail/SMS/WhatsApp delivery and Google
            Maps still read from server environment configuration until a later phase wires those
            through.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <SecretField id="twilio_sid" label="Twilio Account SID" value={data.twilio_sid ?? ''} onChange={(v) => setData('twilio_sid', v)} isSet={integrations['integrations.twilio_sid'] === MASK} />
          <SecretField id="twilio_auth_token" label="Twilio Auth Token" value={data.twilio_auth_token ?? ''} onChange={(v) => setData('twilio_auth_token', v)} isSet={integrations['integrations.twilio_auth_token'] === MASK} />
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <TextField id="twilio_sms_from" label="SMS from number" value={data.twilio_sms_from ?? ''} onChange={(v) => setData('twilio_sms_from', v)} />
            <TextField id="twilio_whatsapp_from" label="WhatsApp from number" value={data.twilio_whatsapp_from ?? ''} onChange={(v) => setData('twilio_whatsapp_from', v)} />
          </div>
          <SecretField id="google_maps_api_key" label="Google Maps API key" value={data.google_maps_api_key ?? ''} onChange={(v) => setData('google_maps_api_key', v)} isSet={integrations['integrations.google_maps_api_key'] === MASK} />
          <TextField id="google_site_verification" label="Google Search Console verification code" value={data.google_site_verification ?? ''} onChange={(v) => setData('google_site_verification', v)} />
          <Button type="submit" disabled={processing}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function DealsBarTab({ bar, dealOptions }: { bar: Record<string, SettingValue>; dealOptions: { id: number; title: string }[] }) {
  return (
    <GroupForm
      group="deals_bar"
      title="Homepage deals bar"
      description="The full-width banner between Services and the offers on the homepage. It shows by default (with a plain headline) while there are live deals; switch it off here, or write your own text. If you set an end date it counts down and hides itself afterwards (salon time zone)."
      fields={{
        enabled: bar['deals_bar.enabled'] === false ? 'false' : 'true',
        badge: toFieldValue(bar['deals_bar.badge']),
        headline: toFieldValue(bar['deals_bar.headline']),
        subtext: toFieldValue(bar['deals_bar.subtext']),
        ends_at: toFieldValue(bar['deals_bar.ends_at']),
        button_label: toFieldValue(bar['deals_bar.button_label']),
        claim_label: toFieldValue(bar['deals_bar.claim_label']),
        claim_url: toFieldValue(bar['deals_bar.claim_url']),
        deal_id: toFieldValue(bar['deals_bar.deal_id']),
      }}
    >
      {(data, setField, fieldError) => (
        <>
          <ToggleField
            id="deals_bar.enabled"
            label="Show the deals bar on the homepage"
            checked={data.enabled === 'true'}
            onChange={(v) => setField('enabled', v ? 'true' : 'false')}
          />
          <TextField id="deals_bar.badge" label="Small label (default: Limited-time offer)" value={data.badge ?? ''} onChange={(v) => setField('badge', v)} error={fieldError('badge')} />
          <TextField id="deals_bar.headline" label="Deal text (headline)" value={data.headline ?? ''} onChange={(v) => setField('headline', v)} error={fieldError('headline')} placeholder="e.g. Bridal packages from Rs. 52,000" />
          <TextField id="deals_bar.subtext" label="Supporting line (optional)" value={data.subtext ?? ''} onChange={(v) => setField('subtext', v)} error={fieldError('subtext')} />
          <div className="space-y-1.5">
            <Label htmlFor="deals_bar.ends_at">Countdown ends (optional)</Label>
            <Input id="deals_bar.ends_at" type="datetime-local" value={data.ends_at ?? ''} onChange={(e) => setField('ends_at', e.target.value)} aria-invalid={!!fieldError('ends_at')} />
            <p className="text-ink-muted text-xs">Pick a date and time, then press Save: the countdown appears on the banner and runs until then (Pakistan time). Leave empty for no countdown. The banner hides itself once the time has passed.</p>
            {fieldError('ends_at') && <p className="text-sm text-red-600">{fieldError('ends_at')}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="deals_bar.deal_id">&quot;Claim&quot; button adds this deal</Label>
            <select
              id="deals_bar.deal_id"
              value={data.deal_id && data.deal_id !== '0' ? data.deal_id : ''}
              onChange={(e) => setField('deal_id', e.target.value)}
              className="border-input bg-background h-9 w-full rounded-md border px-3 text-sm"
            >
              <option value="">Top live deal (automatic)</option>
              {dealOptions.map((deal) => (
                <option key={deal.id} value={String(deal.id)}>{deal.title}</option>
              ))}
            </select>
            <p className="text-ink-muted text-xs">Claim opens the booking page with that deal&apos;s services and promo code already applied.</p>
          </div>
          <div className="space-y-1.5">
            <TextField id="deals_bar.claim_url" label="Claim button link (optional)" value={data.claim_url ?? ''} onChange={(v) => setField('claim_url', v)} error={fieldError('claim_url')} placeholder="/book or https://..." />
            <p className="text-ink-muted text-xs">A page on this site (starting with /) or an https:// link. Leave empty to use the deal chosen above.</p>
          </div>
          <TextField id="deals_bar.claim_label" label="Claim button text (default: Claim offer)" value={data.claim_label ?? ''} onChange={(v) => setField('claim_label', v)} error={fieldError('claim_label')} />
          <TextField id="deals_bar.button_label" label="Button text (default: View all deals)" value={data.button_label ?? ''} onChange={(v) => setField('button_label', v)} error={fieldError('button_label')} />
        </>
      )}
    </GroupForm>
  );
}

function HeroTab({ hero, media }: { hero: Record<string, SettingValue>; media: HeroMediaInfo }) {
  const mb = (bytes: number) => Math.round((bytes / 1048576) * 10) / 10;
  const limit = Math.min(media.limits.upload_max_filesize, media.limits.post_max_size);
  const [uploadError, setUploadError] = React.useState<string | null>(null);

  function upload(kind: 'video' | 'poster', file: File | undefined) {
    setUploadError(null);
    if (!file) return;
    if (kind === 'video' && file.size > 25 * 1024 * 1024) {
      setUploadError('The video must be 25 MB or smaller.');
      return;
    }
    if (file.size > limit) {
      setUploadError(
        `This file is ${mb(file.size)} MB but this server accepts up to ${mb(limit)} MB. On this host large files must be uploaded by FTP into public/images, then choose them below.`,
      );
      return;
    }
    router.post(
      '/admin/hero-media/upload',
      { kind, file },
      {
        forceFormData: true,
        preserveScroll: true,
        onError: (errors) => setUploadError(errors.file ?? 'Upload failed.'),
      },
    );
  }

  return (
    <div className="space-y-6">
      <GroupForm
        group="hero"
        title="Home hero video"
        description="The muted looping video behind the Home page heading. The heading, text and buttons do not change."
        fields={{
          video_enabled: hero['hero.video_enabled'] === false ? 'false' : 'true',
          video_path: toFieldValue(hero['hero.video_path']),
          poster_path: toFieldValue(hero['hero.poster_path']),
        }}
      >
        {(data, setField, fieldError) => (
          <>
            <ToggleField
              id="hero.video_enabled"
              label="Play the video (off shows the poster picture only)"
              checked={data.video_enabled === 'true'}
              onChange={(v) => setField('video_enabled', v ? 'true' : 'false')}
            />
            <div className="space-y-1.5">
              <Label htmlFor="hero.video_path">Use existing file</Label>
              <select
                id="hero.video_path"
                value={data.video_path ?? ''}
                onChange={(e) => setField('video_path', e.target.value)}
                className="border-input bg-background h-10 w-full max-w-md rounded-md border px-3 text-sm"
              >
                <option value="">Default ({media.defaultVideo})</option>
                {media.videos.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
                {data.video_path && !media.videos.includes(data.video_path) && (
                  <option value={data.video_path}>{data.video_path}</option>
                )}
              </select>
              {fieldError('video_path') && (
                <p className="text-sm text-red-600">That file is not available on this site.</p>
              )}
              <p className="text-ink-muted text-xs">
                Lists the .mp4 and .webm files found in public/images.
              </p>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hero.poster_path">Poster picture</Label>
              <select
                id="hero.poster_path"
                value={data.poster_path ?? ''}
                onChange={(e) => setField('poster_path', e.target.value)}
                className="border-input bg-background h-10 w-full max-w-md rounded-md border px-3 text-sm"
              >
                <option value="">Default ({media.defaultPoster})</option>
                {media.posters.map((path) => (
                  <option key={path} value={path}>
                    {path}
                  </option>
                ))}
                {data.poster_path && !media.posters.includes(data.poster_path) && (
                  <option value={data.poster_path}>{data.poster_path}</option>
                )}
              </select>
              {fieldError('poster_path') && (
                <p className="text-sm text-red-600">That file is not available on this site.</p>
              )}
              <p className="text-ink-muted text-xs">
                Shown first on every device and kept when the video cannot play. Use a 16:9
                picture, jpg or webp.
              </p>
            </div>
          </>
        )}
      </GroupForm>

      <Card>
        <CardContent className="space-y-4 p-6">
          <div>
            <h2 className="font-display text-ink text-lg font-medium">Upload a file</h2>
            <p className="text-ink-muted text-sm">
              Video: mp4 or webm, up to 25 MB. Poster: jpg or webp, up to 3 MB. This server accepts
              uploads up to {mb(limit)} MB. On this host large files must be uploaded by FTP into
              public/images, then choose them above.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="hero-upload-video">Video file</Label>
              <Input
                id="hero-upload-video"
                type="file"
                accept="video/mp4,video/webm"
                onChange={(e) => upload('video', e.target.files?.[0])}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="hero-upload-poster">Poster image</Label>
              <Input
                id="hero-upload-poster"
                type="file"
                accept="image/jpeg,image/webp"
                onChange={(e) => upload('poster', e.target.files?.[0])}
              />
            </div>
          </div>
          {uploadError && <p className="text-sm text-red-600">{uploadError}</p>}
        </CardContent>
      </Card>
    </div>
  );
}

const THEME_DEFAULTS = { gold: '#c9a66b', espresso: '#2a2420', ivory: '#faf7f2' };

const THEME_PRESETS: { name: string; values: typeof THEME_DEFAULTS }[] = [
  { name: 'Classic gold', values: THEME_DEFAULTS },
  { name: 'Rose gold', values: { gold: '#b76e79', espresso: '#2d1f21', ivory: '#fbf6f4' } },
  { name: 'Deep emerald', values: { gold: '#2f7a62', espresso: '#1d2a26', ivory: '#f6f8f5' } },
];

const HEX = /^#[0-9A-Fa-f]{6}$/;

function luminance(hex: string): number {
  const channel = (start: number) => {
    const value = parseInt(hex.slice(start, start + 2), 16) / 255;
    return value <= 0.03928 ? value / 12.92 : ((value + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(1) + 0.7152 * channel(3) + 0.0722 * channel(5);
}

/** WCAG 2 contrast ratio between two #RRGGBB colours. */
function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x) as [number, number];
  return (light + 0.05) / (dark + 0.05);
}

const THEME_FIELDS: { key: 'gold' | 'espresso' | 'ivory'; label: string; hint: string }[] = [
  { key: 'gold', label: 'Gold (accent)', hint: 'Buttons, links, highlights.' },
  { key: 'espresso', label: 'Espresso (dark)', hint: 'Headings, body text and dark bands.' },
  { key: 'ivory', label: 'Ivory (page background)', hint: 'The background of every page.' },
];

function ThemeFields({
  data,
  setField,
  fieldError,
}: {
  data: Record<string, string>;
  setField: (key: string, value: string) => void;
  fieldError: (key: string) => string | undefined;
}) {
  const previewRef = React.useRef<HTMLDivElement>(null);
  const colours = {
    gold: HEX.test(data.gold ?? '') ? data.gold! : THEME_DEFAULTS.gold,
    espresso: HEX.test(data.espresso ?? '') ? data.espresso! : THEME_DEFAULTS.espresso,
    ivory: HEX.test(data.ivory ?? '') ? data.ivory! : THEME_DEFAULTS.ivory,
  };

  // The preview is coloured through the CSSOM (CSS variables on its own container), never an inline style attribute.
  React.useEffect(() => {
    const node = previewRef.current;
    if (!node) return;
    node.style.setProperty('--gold', colours.gold);
    node.style.setProperty('--espresso', colours.espresso);
    node.style.setProperty('--ivory', colours.ivory);
  }, [colours.gold, colours.espresso, colours.ivory]);

  const warnings: string[] = [];
  if (contrast('#ffffff', colours.gold) < 3) {
    warnings.push('White text on the gold colour is hard to read (below 3:1). Buttons may be difficult to read.');
  }
  if (contrast(colours.espresso, colours.ivory) < 4.5) {
    warnings.push('The espresso text colour on the ivory background is below 4.5:1, so body text may be hard to read.');
  }
  if (contrast(colours.gold, colours.ivory) < 3) {
    warnings.push('Gold text on the ivory background is below 3:1, so gold links and labels may be hard to read.');
  }

  function applyPreset(values: typeof THEME_DEFAULTS) {
    setField('gold', values.gold);
    setField('espresso', values.espresso);
    setField('ivory', values.ivory);
  }

  function reset() {
    applyPreset(THEME_DEFAULTS);
    router.put(
      '/admin/settings/theme',
      {
        settings: {
          'theme.gold': THEME_DEFAULTS.gold,
          'theme.espresso': THEME_DEFAULTS.espresso,
          'theme.ivory': THEME_DEFAULTS.ivory,
        },
      },
      { preserveScroll: true, onSuccess: () => toast.success('Theme reset to the default colours.') },
    );
  }

  return (
    <>
      <p className="text-ink-muted text-sm">
        Changes apply to the public website after saving. Emails and the app icon keep the original
        colours.
      </p>

      <div className="flex flex-wrap gap-2">
        {THEME_PRESETS.map((preset) => (
          <Button
            key={preset.name}
            type="button"
            variant="outline"
            size="sm"
            onClick={() => applyPreset(preset.values)}
          >
            {preset.name}
          </Button>
        ))}
        <Button type="button" variant="ghost" size="sm" onClick={reset}>
          Reset to default
        </Button>
      </div>

      <div className="grid gap-4 sm:grid-cols-3">
        {THEME_FIELDS.map((field) => (
          <div key={field.key} className="space-y-1.5">
            <Label htmlFor={`theme-${field.key}-hex`}>{field.label}</Label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                aria-label={`${field.label} colour picker`}
                value={colours[field.key]}
                onChange={(e) => setField(field.key, e.target.value)}
                className="border-input size-10 shrink-0 cursor-pointer rounded-md border bg-transparent p-0.5"
              />
              <Input
                id={`theme-${field.key}-hex`}
                value={data[field.key] ?? ''}
                maxLength={7}
                placeholder={THEME_DEFAULTS[field.key]}
                onChange={(e) => setField(field.key, e.target.value.trim())}
                aria-invalid={!!fieldError(field.key) || (!!data[field.key] && !HEX.test(data[field.key]!))}
                className="font-mono"
              />
            </div>
            <p className="text-ink-muted text-xs">{field.hint}</p>
            {fieldError(field.key) && (
              <p className="text-sm text-red-600">Use a colour like #c9a66b (six hex digits).</p>
            )}
          </div>
        ))}
      </div>

      {warnings.length > 0 && (
        <ul className="space-y-1 rounded-md bg-amber-50 p-3 text-sm text-amber-900" role="status">
          {warnings.map((warning) => (
            <li key={warning}>{warning} You can still save.</li>
          ))}
        </ul>
      )}

      <div ref={previewRef} className="overflow-hidden rounded-xl border bg-(--ivory) p-5">
        <p className="text-xs font-semibold tracking-wider text-(--gold) uppercase">Preview</p>
        <div className="mt-3 rounded-lg bg-(--espresso) p-4 text-(--ivory)">
          <p className="font-display text-xl">Bridal artistry, and everyday beauty.</p>
        </div>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <span className="inline-block rounded-md bg-(--gold) px-4 py-2 text-sm font-semibold text-white">
            Book appointment
          </span>
          <span className="text-sm text-(--espresso)">Body text on the page background.</span>
        </div>
      </div>
    </>
  );
}

function ThemeTab({ theme }: { theme: Record<string, SettingValue> }) {
  return (
    <GroupForm
      group="theme"
      title="Theme colours"
      description="Three base colours drive the whole public website. Other shades are worked out from them."
      fields={{
        gold: toFieldValue(theme['theme.gold']) || THEME_DEFAULTS.gold,
        espresso: toFieldValue(theme['theme.espresso']) || THEME_DEFAULTS.espresso,
        ivory: toFieldValue(theme['theme.ivory']) || THEME_DEFAULTS.ivory,
      }}
    >
      {(data, setField, fieldError) => (
        <ThemeFields data={data} setField={setField} fieldError={fieldError} />
      )}
    </GroupForm>
  );
}

function AnalyticsTab({ analytics }: { analytics: Record<string, SettingValue> }) {
  return (
    <GroupForm
      group="analytics"
      title="Analytics"
      description="Google Tag Manager (or a Google Analytics 4 tag) is added to every public page, never to the admin. It only loads on the live site, not on a local copy."
      fields={{
        enabled: analytics['analytics.enabled'] === false ? 'false' : 'true',
        gtm_id: toFieldValue(analytics['analytics.gtm_id']) || 'GTM-WJLPSKGR',
      }}
    >
      {(data, setField, fieldError) => (
        <>
          <ToggleField
            id="analytics.enabled"
            label="Enable Google Tag Manager"
            checked={data.enabled === 'true'}
            onChange={(v) => setField('enabled', v ? 'true' : 'false')}
          />
          <div className="space-y-1.5">
            <Label htmlFor="analytics.gtm_id">GTM container ID</Label>
            <Input
              id="analytics.gtm_id"
              value={data.gtm_id ?? ''}
              onChange={(e) => setField('gtm_id', e.target.value.trim().toUpperCase())}
              aria-invalid={!!fieldError('gtm_id')}
              placeholder="GTM-WJLPSKGR"
              className="max-w-xs"
            />
            {fieldError('gtm_id') && <p className="text-sm text-red-600">{fieldError('gtm_id')}</p>}
            <p className="text-ink-muted text-xs">
              Find it in Google Analytics: Admin, Data streams, your site, Configure tag settings.
              A GTM-... container ID or a G-... measurement ID is accepted.
            </p>
          </div>
        </>
      )}
    </GroupForm>
  );
}

function WaPopupTab({ popup }: { popup: Record<string, SettingValue> }) {
  return (
    <GroupForm
      group="wa_popup"
      title="WhatsApp popup"
      description="A small bubble beside the floating WhatsApp button. It shows once per visitor every 24 hours, never on the booking, login or admin pages."
      fields={{
        enabled: popup['wa_popup.enabled'] === false ? 'false' : 'true',
        message: toFieldValue(popup['wa_popup.message']),
        delay: toFieldValue(popup['wa_popup.delay']),
        sound: popup['wa_popup.sound'] === false ? 'false' : 'true',
      }}
    >
      {(data, setField, fieldError) => (
        <>
          <ToggleField
            id="wa_popup.enabled"
            label="Show the WhatsApp popup"
            checked={data.enabled === 'true'}
            onChange={(v) => setField('enabled', v ? 'true' : 'false')}
          />
          <div className="space-y-1.5">
            <Label htmlFor="wa_popup.message">Message (max 140 characters, plain text)</Label>
            <Input
              id="wa_popup.message"
              maxLength={140}
              value={data.message ?? ''}
              onChange={(e) => setField('message', e.target.value)}
              aria-invalid={!!fieldError('message')}
              placeholder="Need help choosing a service or booking? Chat with us on WhatsApp."
            />
            {fieldError('message') && <p className="text-sm text-red-600">{fieldError('message')}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="wa_popup.delay">Delay in seconds (3 to 60, default 8)</Label>
            <Input
              id="wa_popup.delay"
              type="number"
              min={3}
              max={60}
              value={data.delay ?? ''}
              onChange={(e) => setField('delay', e.target.value)}
              aria-invalid={!!fieldError('delay')}
              className="max-w-[10rem]"
            />
            {fieldError('delay') && <p className="text-sm text-red-600">{fieldError('delay')}</p>}
          </div>
          <ToggleField
            id="wa_popup.sound"
            label="Play a soft sound with the popup (only after the visitor has tapped or clicked the page)"
            checked={data.sound === 'true'}
            onChange={(v) => setField('sound', v ? 'true' : 'false')}
          />
        </>
      )}
    </GroupForm>
  );
}

function SeoSecurityTab({ seo, security }: { seo: Record<string, SettingValue>; security: Record<string, SettingValue> }) {
  return (
    <div className="space-y-6">
      <GroupForm
        group="seo"
        title="SEO Defaults"
        fields={{
          default_title: toFieldValue(seo['seo.default_title']),
          default_description: toFieldValue(seo['seo.default_description']),
        }}
      >
        {(data, setField) => (
          <>
            <TextField id="seo.default_title" label="Default meta title" value={data.default_title ?? ''} onChange={(v) => setField('default_title', v)} />
            <div className="space-y-1.5">
              <Label htmlFor="seo.default_description">Default meta description</Label>
              <Textarea id="seo.default_description" rows={2} value={data.default_description ?? ''} onChange={(e) => setField('default_description', e.target.value)} />
            </div>
          </>
        )}
      </GroupForm>

      <GroupForm
        group="security"
        title="Security"
        description="Admin IP allowlist and session lifetime are stored here but not yet enforced — a later security pass will wire these into the auth/session middleware."
        fields={{
          admin_ip_allowlist: toFieldValue(security['security.admin_ip_allowlist']),
          session_lifetime_minutes: toFieldValue(security['security.session_lifetime_minutes']),
        }}
      >
        {(data, setField) => (
          <>
            <TextField
              id="security.admin_ip_allowlist"
              label="Admin IP allowlist (comma-separated)"
              value={data.admin_ip_allowlist ?? ''}
              onChange={(v) => setField('admin_ip_allowlist', v)}
              placeholder="203.0.113.0/24, 198.51.100.7"
            />
            <TextField
              id="security.session_lifetime_minutes"
              label="Session lifetime (minutes)"
              value={data.session_lifetime_minutes ?? ''}
              onChange={(v) => setField('session_lifetime_minutes', v)}
            />
          </>
        )}
      </GroupForm>
    </div>
  );
}

export default function SettingsIndex({ settings, businessHours, dealOptions, heroMedia }: SettingsIndexPageProps) {
  const [tab, setTab] = React.useState<TabId>('general');

  return (
    <>
      <Head title="Settings" />
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-ink text-2xl font-medium">Settings</h1>
          <p className="text-ink-muted text-sm">Business configuration, cached in Redis for fast reads.</p>
        </div>

        <div role="tablist" aria-label="Settings sections" className="border-border-soft flex flex-wrap gap-1 border-b pb-px">
          {TABS.map((t) => (
            <button
              key={t.id}
              type="button"
              role="tab"
              id={`tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`panel-${t.id}`}
              onClick={() => setTab(t.id)}
              className={cn(
                'rounded-t-md px-4 py-2 text-sm font-medium',
                tab === t.id
                  ? 'border-accent-500 text-accent-700 border-b-2'
                  : 'text-ink-muted hover:text-ink',
              )}
            >
              {t.label}
            </button>
          ))}
        </div>

        <div id={`panel-${tab}`} role="tabpanel" aria-labelledby={`tab-${tab}`}>
          {tab === 'general' && <GeneralTab business={settings.business} />}
          {tab === 'hours' && <HoursTab businessHours={businessHours} />}
          {tab === 'booking' && <BookingTab booking={settings.booking} />}
          {tab === 'payments' && <PaymentsTab payments={settings.payments} />}
          {tab === 'integrations' && <IntegrationsTab integrations={settings.integrations} />}
          {tab === 'wa-popup' && <WaPopupTab popup={settings.wa_popup} />}
          {tab === 'hero' && <HeroTab hero={settings.hero} media={heroMedia} />}
          {tab === 'theme' && <ThemeTab theme={settings.theme} />}
          {tab === 'analytics' && <AnalyticsTab analytics={settings.analytics} />}
          {tab === 'deals-bar' && <DealsBarTab bar={settings.deals_bar} dealOptions={dealOptions} />}
          {tab === 'seo-security' && <SeoSecurityTab seo={settings.seo} security={settings.security} />}
        </div>
      </div>
    </>
  );
}

SettingsIndex.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
