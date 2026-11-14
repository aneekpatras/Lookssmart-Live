import { Head, Link, router, useForm } from '@inertiajs/react';
import { ArrowDown, ArrowUp, Star, Trash2 } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/Components/ui/select';
import { Switch } from '@/Components/ui/switch';
import AdminLayout from '@/Layouts/AdminLayout';

interface GalleryImageDetail {
  id: number;
  image_url: string;
  pair_image_url: string | null;
  caption: string | null;
  specialty?: string | null;
  is_before_after: boolean;
  show_on_homepage: boolean;
  linked_type?: 'service' | 'deal' | null;
  linked_id?: number | null;
  sort: number;
}

interface LinkOption {
  type: 'service' | 'deal';
  id: number;
  name: string;
}

interface GalleryCategoryOption {
  id: number;
  name: string;
}

interface GalleryDetail {
  id: number;
  title: string;
  slug: string;
  gallery_category_id: number | null;
  sort: number;
  is_active: boolean;
  cover_image_id: number | null;
  images: GalleryImageDetail[];
}

interface GalleryFormPageProps {
  gallery?: GalleryDetail;
  categories: GalleryCategoryOption[];
  linkOptions?: LinkOption[];
}

function AlbumDetailsCard({ gallery, categories }: { gallery?: GalleryDetail; categories: GalleryCategoryOption[] }) {
  const isEdit = !!gallery;
  const { data, setData, post, put, processing, errors } = useForm({
    title: gallery?.title ?? '',
    gallery_category_id: gallery?.gallery_category_id ? String(gallery.gallery_category_id) : '',
    is_active: gallery?.is_active ?? true,
  });

  function submit(event: React.FormEvent) {
    event.preventDefault();
    if (isEdit) {
      put(`/admin/gallery/${gallery.id}`);
    } else {
      post('/admin/gallery');
    }
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <h2 className="font-display text-ink text-lg font-medium">Album details</h2>
        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="title">Title</Label>
            <Input
              id="title"
              value={data.title}
              onChange={(e) => setData('title', e.target.value)}
              aria-invalid={!!errors.title}
              required
            />
            {errors.title && <p className="text-sm text-red-600">{errors.title}</p>}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="gallery_category_id">Category</Label>
            <Select
              value={data.gallery_category_id || undefined}
              onValueChange={(value) => setData('gallery_category_id', value)}
            >
              <SelectTrigger id="gallery_category_id" aria-invalid={!!errors.gallery_category_id}>
                <SelectValue placeholder="No category" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={String(category.id)}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {errors.gallery_category_id && <p className="text-sm text-red-600">{errors.gallery_category_id}</p>}
          </div>
          <label htmlFor="is_active" className="flex items-center gap-2">
            <Switch
              id="is_active"
              checked={data.is_active}
              onCheckedChange={(checked) => setData('is_active', checked === true)}
            />
            <span className="text-sm">Active</span>
          </label>
          <div className="flex items-center gap-3 pt-1">
            <Button type="submit" disabled={processing}>
              {isEdit ? 'Save changes' : 'Create album'}
            </Button>
            <Button asChild variant="outline">
              <Link href="/admin/gallery">Cancel</Link>
            </Button>
          </div>
        </form>
      </CardContent>
    </Card>
  );
}

/** Searchable "Linked service or deal" picker: type to filter, pick one, or clear it. */
function LinkedItemPicker({
  options,
  value,
  onChange,
}: {
  options: LinkOption[];
  value: LinkOption | null;
  onChange: (option: LinkOption | null) => void;
}) {
  const [query, setQuery] = React.useState('');
  const [open, setOpen] = React.useState(false);
  const matches = React.useMemo(() => {
    const needle = query.trim().toLowerCase();
    return options.filter((option) => !needle || option.name.toLowerCase().includes(needle)).slice(0, 50);
  }, [options, query]);

  return (
    <div className="relative space-y-1">
      <p className="text-ink-muted text-xs font-medium">Linked service or deal (optional)</p>
      {value && !open ? (
        <div className="border-input flex items-center justify-between gap-2 rounded-md border px-3 py-1.5 text-sm">
          <span className="min-w-0 truncate">
            {value.name}{' '}
            <span className="bg-accent-50 text-accent-700 ml-1 rounded-full px-2 py-0.5 text-[10px] font-semibold">
              {value.type === 'deal' ? 'Deal' : 'Service'}
            </span>
          </span>
          <span className="flex shrink-0 gap-2">
            <button type="button" className="text-accent-700 text-xs underline" onClick={() => setOpen(true)}>
              Change
            </button>
            <button type="button" className="text-xs text-red-600 underline" onClick={() => onChange(null)}>
              Clear
            </button>
          </span>
        </div>
      ) : (
        <>
          <Input
            aria-label="Search services and deals"
            placeholder="Type to search services and deals"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setOpen(true);
            }}
            onFocus={() => setOpen(true)}
          />
          {open && (
            <ul className="border-border-soft bg-ivory shadow-soft absolute z-20 max-h-56 w-full overflow-y-auto rounded-md border text-sm">
              {matches.length === 0 && <li className="text-ink-muted px-3 py-2">No matches</li>}
              {matches.map((option) => (
                <li key={`${option.type}-${option.id}`}>
                  <button
                    type="button"
                    className="hover:bg-accent-50 flex w-full items-center justify-between gap-2 px-3 py-2 text-left"
                    onClick={() => {
                      onChange(option);
                      setQuery('');
                      setOpen(false);
                    }}
                  >
                    <span className="truncate">{option.name}</span>
                    <span className="bg-accent-50 text-accent-700 shrink-0 rounded-full px-2 py-0.5 text-[10px] font-semibold">
                      {option.type === 'deal' ? 'Deal' : 'Service'}
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}

function ImageCard({
  image,
  galleryId,
  isCover,
  isFirst,
  isLast,
  onMove,
  linkOptions,
}: {
  linkOptions: LinkOption[];
  image: GalleryImageDetail;
  galleryId: number;
  isCover: boolean;
  isFirst: boolean;
  isLast: boolean;
  onMove: (direction: -1 | 1) => void;
}) {
  const { data, setData, put, processing } = useForm({
    caption: image.caption ?? '',
    specialty: image.specialty ?? '',
    is_before_after: image.is_before_after,
    show_on_homepage: image.show_on_homepage,
    pair_image: null as File | null,
  });

  function saveCaption() {
    put(`/admin/gallery/${galleryId}/images/${image.id}`, { preserveScroll: true, forceFormData: true });
  }

  const [linked, setLinked] = React.useState<LinkOption | null>(
    () => linkOptions.find((o) => o.type === image.linked_type && o.id === image.linked_id) ?? null,
  );

  function saveLink(option: LinkOption | null) {
    setLinked(option);
    router.put(
      `/admin/gallery/${galleryId}/images/${image.id}`,
      { linked_type: option?.type ?? null, linked_id: option?.id ?? null },
      { preserveScroll: true },
    );
  }

  function toggleBeforeAfter(checked: boolean) {
    setData('is_before_after', checked);
    router.put(
      `/admin/gallery/${galleryId}/images/${image.id}`,
      { caption: data.caption, specialty: data.specialty, is_before_after: checked },
      { preserveScroll: true },
    );
  }

  /**
   * Sends ONLY `show_on_homepage`. `UpdateGalleryImageRequest` leaves absent keys out of
   * `validated()`, so the caption and before/after flag are untouched — no need to echo them back
   * and no risk of overwriting a caption the admin is mid-edit in another field.
   */
  function toggleHomepageSlider(checked: boolean) {
    setData('show_on_homepage', checked);
    router.put(
      `/admin/gallery/${galleryId}/images/${image.id}`,
      { show_on_homepage: checked },
      { preserveScroll: true },
    );
  }

  function uploadPairImage(file: File) {
    setData('pair_image', file);
    router.post(
      `/admin/gallery/${galleryId}/images/${image.id}`,
      { _method: 'put', caption: data.caption, specialty: data.specialty, is_before_after: true, pair_image: file },
      { preserveScroll: true, forceFormData: true },
    );
  }

  function setCover() {
    router.post(`/admin/gallery/${galleryId}/cover`, { image_id: image.id }, { preserveScroll: true });
  }

  function destroy() {
    if (confirm('Delete this image?')) {
      router.delete(`/admin/gallery/${galleryId}/images/${image.id}`, { preserveScroll: true });
    }
  }

  return (
    <Card className="overflow-hidden">
      <div className="relative aspect-square bg-accent-50">
        <img src={image.image_url} alt="" className="size-full object-cover" />
        {isCover && (
          <span className="bg-accent-600 absolute top-2 left-2 rounded-full px-2 py-0.5 text-xs font-medium text-white">
            Cover
          </span>
        )}
      </div>
      <CardContent className="space-y-3 p-3">
        <Input
          aria-label="Caption"
          placeholder="Caption"
          value={data.caption}
          onChange={(e) => setData('caption', e.target.value)}
          onBlur={saveCaption}
        />
        <Input
          aria-label="Specialty"
          placeholder="Specialty (shown under the photo, max 160)"
          maxLength={160}
          value={data.specialty}
          onChange={(e) => setData('specialty', e.target.value)}
          onBlur={saveCaption}
        />

        <LinkedItemPicker options={linkOptions} value={linked} onChange={saveLink} />

        <div className="flex items-center gap-2 text-sm">
          <Switch
            checked={data.is_before_after}
            onCheckedChange={toggleBeforeAfter}
            aria-label="Mark as before/after pair"
          />
          <span>Before/After pair</span>
        </div>

        <div className="flex items-center gap-2 text-sm">
          <Switch
            checked={data.show_on_homepage}
            onCheckedChange={toggleHomepageSlider}
            aria-label="Show on Homepage Slider"
          />
          <span>Show on Homepage Slider</span>
        </div>

        {data.is_before_after && (
          <div className="space-y-1.5">
            {image.pair_image_url ? (
              <img src={image.pair_image_url} alt="After" className="h-16 w-full rounded object-cover" />
            ) : (
              <p className="text-ink-muted text-xs">No &quot;after&quot; image yet.</p>
            )}
            <Input
              aria-label="Upload after image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) uploadPairImage(file);
              }}
              disabled={processing}
            />
          </div>
        )}

        <div className="flex items-center justify-between">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" disabled={isFirst} aria-label="Move up" onClick={() => onMove(-1)}>
              <ArrowUp className="size-4" />
            </Button>
            <Button type="button" variant="ghost" size="icon" disabled={isLast} aria-label="Move down" onClick={() => onMove(1)}>
              <ArrowDown className="size-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" aria-label="Set as cover image" onClick={setCover}>
              <Star className={isCover ? 'size-4 fill-current text-amber-500' : 'size-4'} />
            </Button>
            <Button type="button" variant="ghost" size="icon" aria-label="Delete image" onClick={destroy}>
              <Trash2 className="size-4 text-red-600" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

function MediaOrganizer({ gallery, linkOptions }: { gallery: GalleryDetail; linkOptions: LinkOption[] }) {
  const images = gallery.images;
  const uploadForm = useForm<{ images: File[] }>({ images: [] });

  function handleUpload(event: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(event.target.files ?? []);
    if (files.length === 0) return;

    uploadForm.setData('images', files);
    uploadForm.post(`/admin/gallery/${gallery.id}/images`, {
      forceFormData: true,
      preserveScroll: true,
      onSuccess: () => uploadForm.reset(),
    });
    event.target.value = '';
  }

  function move(index: number, direction: -1 | 1) {
    const target = index + direction;
    if (target < 0 || target >= images.length) return;

    const reordered = [...images];
    const current = reordered[index];
    const swapWith = reordered[target];
    if (!current || !swapWith) return;
    reordered[index] = swapWith;
    reordered[target] = current;

    router.post(
      `/admin/gallery/${gallery.id}/images/reorder`,
      { order: reordered.map((image) => image.id) },
      { preserveScroll: true },
    );
  }

  return (
    <Card>
      <CardContent className="space-y-5 p-6">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-ink text-lg font-medium">Photos</h2>
          <div>
            <Label htmlFor="bulk-upload" className="sr-only">
              Upload images
            </Label>
            <Input
              id="bulk-upload"
              type="file"
              multiple
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={handleUpload}
              disabled={uploadForm.processing}
            />
          </div>
        </div>
        {uploadForm.errors.images && <p className="text-sm text-red-600">{uploadForm.errors.images}</p>}

        {images.length === 0 ? (
          <p className="text-ink-muted text-sm">No photos yet. Upload some above.</p>
        ) : (
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4">
            {images.map((image, index) => (
              <ImageCard
                key={image.id}
                image={image}
                galleryId={gallery.id}
                isCover={gallery.cover_image_id === image.id}
                isFirst={index === 0}
                isLast={index === images.length - 1}
                onMove={(direction) => move(index, direction)}
                linkOptions={linkOptions}
              />
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function GalleryForm({ gallery, categories, linkOptions = [] }: GalleryFormPageProps) {
  return (
    <>
      <Head title={gallery ? 'Edit Album' : 'New Album'} />
      <div className="mx-auto max-w-5xl space-y-6">
        <div>
          <h1 className="font-display text-ink text-2xl font-medium">
            {gallery ? 'Edit album' : 'New album'}
          </h1>
        </div>

        <AlbumDetailsCard gallery={gallery} categories={categories} />
        {gallery && <MediaOrganizer gallery={gallery} linkOptions={linkOptions} />}
      </div>
    </>
  );
}

GalleryForm.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
