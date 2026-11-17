import { Head, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Switch } from '@/Components/ui/switch';
import { Textarea } from '@/Components/ui/textarea';
import AdminLayout from '@/Layouts/AdminLayout';

type Options = Record<string, string | number | boolean>;

interface SlideRow {
  id: number;
  title: string;
  subtitle: string | null;
  link: string | null;
  focus: 'top' | 'center';
  fit?: 'cover' | 'contain';
  is_active: boolean;
  image_url: string;
}

interface PageProps {
  tableReady: boolean;
  options: Options;
  defaults: Options;
  slides: SlideRow[];
}

const TEXT_FIELDS: { key: string; label: string; max: number; area?: boolean }[] = [
  { key: 'eyebrow', label: 'Eyebrow pill', max: 80 },
  { key: 'heading_1', label: 'Heading, line 1', max: 60 },
  { key: 'heading_2', label: 'Heading, line 2 (italic gold)', max: 60 },
  { key: 'paragraph', label: 'Paragraph', max: 300, area: true },
  { key: 'chips_label', label: 'Label above the quick-pick chips', max: 60 },
  { key: 'deal_label', label: 'Deal card label', max: 40 },
  { key: 'deal_button_label', label: 'Deal card button label', max: 30 },
  { key: 'deal_button_url', label: 'Deal card button link', max: 255 },
  { key: 'primary_label', label: 'Primary button label', max: 30 },
  { key: 'primary_url', label: 'Primary button link', max: 255 },
  { key: 'secondary_label', label: 'Secondary button label', max: 30 },
  { key: 'secondary_url', label: 'Secondary button link', max: 255 },
  { key: 'trust_1', label: 'Trust item 1 (empty hides it)', max: 40 },
  { key: 'trust_2', label: 'Trust item 2 (empty hides it)', max: 40 },
  { key: 'trust_3', label: 'Trust item 3 (empty hides it)', max: 40 },
  { key: 'card_title', label: 'Top-right card title', max: 30 },
  { key: 'card_line', label: 'Top-right card line', max: 40 },
];

const SWITCHES = [
  { key: 'enabled', label: 'Show the showcase section on Home' },
  { key: 'chips_enabled', label: 'Show the quick-pick category chips' },
  { key: 'deal_enabled', label: 'Show the current deal card' },
];

function TextsCard({ options, defaults }: { options: Options; defaults: Options }) {
  const initial: Record<string, string> = {};
  for (const [key, value] of Object.entries(options)) initial[key] = String(value);
  const { data, setData, transform, put, processing, errors } =
    useForm<Record<string, string>>(initial);

  function submit(event: React.FormEvent) {
    event.preventDefault();
    transform((current) => ({
      settings: Object.fromEntries(
        Object.entries(current).map(([key, value]) => [`showcase.${key}`, value]),
      ),
    }));
    put('/admin/settings/showcase', {
      preserveScroll: true,
      onSuccess: () => toast.success('Showcase settings saved.'),
    });
  }

  const err = (key: string) => errors[`settings.showcase.${key}` as keyof typeof errors];

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div>
          <h2 className="font-display text-ink text-lg font-medium">Section texts and options</h2>
          <p className="text-ink-muted text-sm">
            Plain text only. Links must start with &ldquo;/&rdquo; or &ldquo;https://&rdquo;. Leave
            a field empty to use the default.
          </p>
        </div>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-2">
            {SWITCHES.map((item) => (
              <label key={item.key} className="flex items-center gap-2">
                <Switch
                  checked={data[item.key] !== 'false'}
                  onCheckedChange={(v) => setData(item.key, v ? 'true' : 'false')}
                />
                <span className="text-sm">{item.label}</span>
              </label>
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {TEXT_FIELDS.map((field) => (
              <div
                key={field.key}
                className={field.area ? 'space-y-1.5 sm:col-span-2' : 'space-y-1.5'}
              >
                <Label htmlFor={`sc-${field.key}`}>{field.label}</Label>
                {field.area ? (
                  <Textarea
                    id={`sc-${field.key}`}
                    rows={3}
                    maxLength={field.max}
                    value={data[field.key] ?? ''}
                    onChange={(e) => setData(field.key, e.target.value)}
                  />
                ) : (
                  <Input
                    id={`sc-${field.key}`}
                    maxLength={field.max}
                    value={data[field.key] ?? ''}
                    placeholder={String(defaults[field.key] ?? '')}
                    onChange={(e) => setData(field.key, e.target.value)}
                    aria-invalid={!!err(field.key)}
                  />
                )}
                {err(field.key) && <p className="text-sm text-red-600">{err(field.key)}</p>}
              </div>
            ))}
            <div className="space-y-1.5">
              <Label htmlFor="sc-interval">Slide interval in seconds (3 to 15)</Label>
              <Input
                id="sc-interval"
                type="number"
                min={3}
                max={15}
                value={data.interval ?? '5'}
                onChange={(e) => setData('interval', e.target.value)}
                className="max-w-32"
                aria-invalid={!!err('interval')}
              />
              {err('interval') && <p className="text-sm text-red-600">{err('interval')}</p>}
            </div>
          </div>
          <Button type="submit" disabled={processing}>
            Save
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

function SlideForm({ slide, onDone }: { slide: SlideRow | null; onDone: () => void }) {
  const { data, setData, post, processing, errors, reset } = useForm({
    title: slide?.title ?? '',
    subtitle: slide?.subtitle ?? '',
    link: slide?.link ?? '',
    focus: slide?.focus ?? 'top',
    fit: slide?.fit ?? 'cover',
    image: null as File | null,
    _method: slide ? 'put' : 'post',
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    post(slide ? `/admin/showcase/slides/${slide.id}` : '/admin/showcase/slides', {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => {
        reset();
        onDone();
      },
    });
  }

  return (
    <form onSubmit={submit} className="border-border-soft space-y-4 rounded-xl border p-4">
      <h3 className="font-display text-ink font-medium">{slide ? 'Edit slide' : 'Add slide'}</h3>
      <div className="space-y-1.5">
        <Label htmlFor="sl-image">Image (jpg, png or webp, max 3 MB)</Label>
        <Input
          id="sl-image"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          onChange={(e) => setData('image', e.target.files?.[0] ?? null)}
        />
        <p className="text-ink-muted text-xs">
          Use a full portrait of the bride so the whole look fits. A portrait 3:4 image at least
          900px wide works best.
        </p>
        {errors.image && <p className="text-sm text-red-600">{errors.image}</p>}
      </div>
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-1.5">
          <Label htmlFor="sl-title">Title (required)</Label>
          <Input
            id="sl-title"
            maxLength={120}
            value={data.title}
            onChange={(e) => setData('title', e.target.value)}
          />
          {errors.title && <p className="text-sm text-red-600">{errors.title}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sl-subtitle">Subtitle</Label>
          <Input
            id="sl-subtitle"
            maxLength={160}
            value={data.subtitle}
            onChange={(e) => setData('subtitle', e.target.value)}
          />
          {errors.subtitle && <p className="text-sm text-red-600">{errors.subtitle}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sl-link">Link (optional)</Label>
          <Input
            id="sl-link"
            maxLength={255}
            placeholder="/gallery"
            value={data.link}
            onChange={(e) => setData('link', e.target.value)}
          />
          {errors.link && <p className="text-sm text-red-600">{errors.link}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sl-focus">Image focus</Label>
          <select
            id="sl-focus"
            value={data.focus}
            onChange={(e) => setData('focus', e.target.value as 'top' | 'center')}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          >
            <option value="top">Top (keeps the face visible)</option>
            <option value="center">Center</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="sl-fit">Image fit</Label>
          <select
            id="sl-fit"
            value={data.fit}
            onChange={(e) => setData('fit', e.target.value as 'cover' | 'contain')}
            className="border-input bg-background h-10 w-full rounded-md border px-3 text-sm"
          >
            <option value="cover">Fill the frame</option>
            <option value="contain">Show whole image</option>
          </select>
          <p className="text-ink-muted text-xs">
            Best results: portrait 3:4, at least 900px wide. Wide photos: choose &apos;Show whole
            image&apos;.
          </p>
        </div>
      </div>
      <div className="flex gap-2">
        <Button type="submit" disabled={processing}>
          {slide ? 'Save slide' : 'Add slide'}
        </Button>
        <Button type="button" variant="outline" onClick={onDone}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

function SlidesCard({ slides, tableReady }: { slides: SlideRow[]; tableReady: boolean }) {
  const [editing, setEditing] = React.useState<SlideRow | 'new' | null>(null);

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    const a = slides[index];
    const b = slides[target];
    if (!a || !b) return;
    const order = slides.map((slide) => slide.id);
    order[index] = b.id;
    order[target] = a.id;
    router.post('/admin/showcase/slides/reorder', { order }, { preserveScroll: true });
  }

  return (
    <Card>
      <CardContent className="space-y-4 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-ink text-lg font-medium">Slides</h2>
            <p className="text-ink-muted text-sm">
              The images that slide inside the arch. With no active slides, Home uses the gallery
              photos marked &ldquo;show on homepage&rdquo;.
            </p>
          </div>
          {tableReady && (
            <Button type="button" onClick={() => setEditing('new')}>
              <Plus aria-hidden="true" /> Add slide
            </Button>
          )}
        </div>

        {!tableReady && (
          <p className="rounded-md bg-amber-50 p-3 text-sm text-amber-900">
            The slides table does not exist yet. Run the SQL file (lookssmart-ALL-SQL.sql) first.
          </p>
        )}

        {editing && (
          <SlideForm
            key={editing === 'new' ? 'new' : editing.id}
            slide={editing === 'new' ? null : editing}
            onDone={() => setEditing(null)}
          />
        )}

        <ul className="divide-border-soft divide-y">
          {slides.map((slide, index) => (
            <li key={slide.id} className="flex flex-wrap items-center gap-3 py-3">
              <img
                src={slide.image_url}
                alt=""
                className="h-16 w-12 rounded-md object-cover"
                loading="lazy"
              />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{slide.title}</p>
                {slide.subtitle && (
                  <p className="text-ink-muted truncate text-xs">{slide.subtitle}</p>
                )}
              </div>
              <div className="flex items-center gap-2 text-xs">
                <Switch
                  aria-label={`Active: ${slide.title}`}
                  checked={slide.is_active}
                  onCheckedChange={(v) =>
                    router.put(
                      `/admin/showcase/slides/${slide.id}`,
                      { is_active: v === true },
                      { preserveScroll: true },
                    )
                  }
                />
                Active
              </div>
              <div className="flex gap-1">
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Move up"
                  disabled={index === 0}
                  onClick={() => move(index, -1)}
                >
                  <ArrowUp />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Move down"
                  disabled={index === slides.length - 1}
                  onClick={() => move(index, 1)}
                >
                  <ArrowDown />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Edit slide"
                  onClick={() => setEditing(slide)}
                >
                  <Pencil />
                </Button>
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Delete slide"
                  onClick={() => {
                    if (window.confirm(`Delete the "${slide.title}" slide?`)) {
                      router.delete(`/admin/showcase/slides/${slide.id}`, { preserveScroll: true });
                    }
                  }}
                >
                  <Trash2 />
                </Button>
              </div>
            </li>
          ))}
        </ul>
        {tableReady && slides.length === 0 && (
          <p className="text-ink-muted text-sm">No slides yet.</p>
        )}
      </CardContent>
    </Card>
  );
}

export default function ShowcaseIndex({ tableReady, options, defaults, slides }: PageProps) {
  return (
    <>
      <Head title="Home showcase" />
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-ink text-2xl font-medium">Home showcase</h1>
          <p className="text-ink-muted text-sm">
            The section under the hero video and the offers banner on the Home page.
          </p>
        </div>
        <TextsCard options={options} defaults={defaults} />
        <SlidesCard slides={slides} tableReady={tableReady} />
      </div>
    </>
  );
}

ShowcaseIndex.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
