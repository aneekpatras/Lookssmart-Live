import { Head, router, useForm } from '@inertiajs/react';
import { GripVertical, MoreHorizontal, Plus } from 'lucide-react';
import * as React from 'react';

import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Checkbox } from '@/Components/ui/checkbox';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/Components/ui/dialog';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/Components/ui/dropdown-menu';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import AdminLayout from '@/Layouts/AdminLayout';

interface CategoryRow {
  id: number;
  name: string;
  slug: string;
  sort: number;
  is_active: boolean;
  services_count: number;
  image_url: string | null;
}

interface ServiceCategoriesPageProps {
  categories: {
    data: CategoryRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  filters: { search: string | null; sort: string; direction: 'asc' | 'desc' };
}

function CategoryDialog({
  category,
  trigger,
}: {
  category?: CategoryRow;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = React.useState(false);
  const { data, setData, post, processing, errors, reset } = useForm({
    name: category?.name ?? '',
    is_active: category?.is_active ?? true,
    image: null as File | null,
    _method: category ? 'put' : 'post',
  });

  function submit(e: React.FormEvent) {
    e.preventDefault();
    const url = category ? `/admin/service-categories/${category.id}` : '/admin/service-categories';
    post(url, {
      forceFormData: true,
      onSuccess: () => {
        setOpen(false);
        reset();
      },
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <form onSubmit={submit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>{category ? 'Edit category' : 'New category'}</DialogTitle>
            <DialogDescription>Categories group services on the booking page.</DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label htmlFor="category-name">Name</Label>
            <Input
              id="category-name"
              value={data.name}
              onChange={(e) => setData('name', e.target.value)}
              aria-invalid={!!errors.name}
              required
            />
            {errors.name ? <p className="text-sm text-red-600">{errors.name}</p> : null}
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="category-image">Image</Label>
            <Input
              id="category-image"
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => setData('image', e.target.files?.[0] ?? null)}
            />
            {errors.image ? <p className="text-sm text-red-600">{errors.image}</p> : null}
          </div>
          <label htmlFor="category-active" className="flex items-center gap-2 text-sm">
            <Checkbox
              id="category-active"
              checked={data.is_active}
              onCheckedChange={(checked) => setData('is_active', checked === true)}
            />
            Active
          </label>
          <DialogFooter>
            <Button type="submit" disabled={processing}>
              {category ? 'Save changes' : 'Create category'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function CategoryRowActions({ row }: { row: CategoryRow }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button type="button" variant="ghost" size="icon" aria-label={`Actions for ${row.name}`}>
          <MoreHorizontal className="size-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <CategoryDialog
          category={row}
          trigger={<DropdownMenuItem onSelect={(e) => e.preventDefault()}>Edit</DropdownMenuItem>}
        />
        <DropdownMenuItem
          className="text-red-600 hover:bg-red-50 focus:bg-red-50"
          onSelect={() => {
            if (confirm(`Delete "${row.name}"? Services in it are not deleted.`)) {
              router.delete(`/admin/service-categories/${row.id}`);
            }
          }}
        >
          Delete
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default function ServiceCategories({ categories }: ServiceCategoriesPageProps) {
  const [items, setItems] = React.useState<CategoryRow[]>(categories.data);
  const [draggingId, setDraggingId] = React.useState<number | null>(null);
  // Snapshot of the order when a drag starts, so a drop outside the list can be undone.
  const startOrder = React.useRef<number[]>([]);

  // Follow the server whenever it sends fresh data (after a save, create or delete).
  const [syncedData, setSyncedData] = React.useState(categories.data);
  if (syncedData !== categories.data) {
    setSyncedData(categories.data);
    setItems(categories.data);
  }

  function onDragStart(id: number) {
    startOrder.current = items.map((item) => item.id);
    setDraggingId(id);
  }

  function onDragOver(e: React.DragEvent, overId: number) {
    e.preventDefault();
    if (draggingId === null || draggingId === overId) return;

    setItems((current) => {
      const from = current.findIndex((item) => item.id === draggingId);
      const to = current.findIndex((item) => item.id === overId);
      if (from < 0 || to < 0) return current;
      const next = [...current];
      const [moved] = next.splice(from, 1);
      if (!moved) return current;
      next.splice(to, 0, moved);
      return next;
    });
  }

  function onDragEnd() {
    const order = items.map((item) => item.id);
    setDraggingId(null);
    if (order.join(',') === startOrder.current.join(',')) return;

    router.post('/admin/service-categories/reorder', { order }, { preserveScroll: true });
  }

  return (
    <>
      <Head title="Service Categories" />
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-ink text-2xl font-medium">Service Categories</h1>
            <p className="text-ink-muted text-sm">
              Drag a category by its handle and drop it where you want it. This is the order they
              appear in on the public Services page.
            </p>
          </div>
          <CategoryDialog
            trigger={
              <Button type="button">
                <Plus className="size-4" />
                New category
              </Button>
            }
          />
        </div>

        {items.length === 0 ? (
          <p className="text-ink-muted text-sm">No categories yet.</p>
        ) : (
          <ul className="border-border-soft bg-surface divide-border-soft divide-y rounded-2xl border">
            {items.map((row) => (
              <li
                key={row.id}
                draggable
                onDragStart={() => onDragStart(row.id)}
                onDragOver={(e) => onDragOver(e, row.id)}
                onDrop={(e) => e.preventDefault()}
                onDragEnd={onDragEnd}
                className={`flex cursor-grab items-center gap-4 px-4 py-3 active:cursor-grabbing ${
                  draggingId === row.id ? 'bg-accent-50 opacity-60' : ''
                }`}
              >
                <GripVertical className="text-ink-muted size-5 shrink-0" aria-hidden="true" />
                {row.image_url ? (
                  <img src={row.image_url} alt="" className="size-10 rounded object-cover" draggable={false} />
                ) : (
                  <div className="bg-sand size-10 rounded" />
                )}
                <div className="min-w-0 flex-1">
                  <p className="text-ink truncate font-medium">{row.name}</p>
                  <p className="text-ink-muted truncate text-xs">
                    {row.slug} &middot; {row.services_count}{' '}
                    {row.services_count === 1 ? 'service' : 'services'}
                  </p>
                </div>
                <Badge variant={row.is_active ? 'accent' : 'outline'}>
                  {row.is_active ? 'Active' : 'Inactive'}
                </Badge>
                <CategoryRowActions row={row} />
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  );
}

ServiceCategories.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
