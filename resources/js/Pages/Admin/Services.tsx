import { Head, router } from '@inertiajs/react';
import { Download, Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

import {
  DataTable,
  type DataTableColumn,
  type DataTablePaginationMeta,
} from '@/Components/admin/DataTable';
import { ServiceFormDialog, type ServiceDialogRow } from '@/Components/admin/ServiceFormDialog';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import AdminLayout from '@/Layouts/AdminLayout';
import { formatCurrency } from '@/lib/currency';

interface ServiceRow extends ServiceDialogRow {
  slug: string;
  category: string | null;
}

interface ServicesPageProps {
  services: {
    data: ServiceRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  filters: { search: string | null; category_id: number | null; sort: string; direction: 'asc' | 'desc' };
  categories: { id: number; name: string }[];
  staff: { id: number; name: string | null }[];
}

function ServiceRowActions({ row, onEdit }: { row: ServiceRow; onEdit: (row: ServiceRow) => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Edit ${row.name}`}
      onClick={() => onEdit(row)}
    >
      <Pencil className="size-3.5" />
      Edit
    </Button>
  );
}

export default function Services({ services, filters, categories, staff }: ServicesPageProps) {
  const [dialogTarget, setDialogTarget] = React.useState<ServiceRow | null | undefined>(undefined);

  function deleteAllMatching() {
    const scope = filters.search || filters.category_id ? 'matching the current filter' : 'ALL';
    if (confirm(`Delete ${scope} ${services.total} service(s)? Past bookings keep their history.`)) {
      router.post('/admin/services/bulk-delete', {
        all: true,
        search: filters.search ?? undefined,
        category_id: filters.category_id ?? undefined,
      });
    }
  }

  const columns: DataTableColumn<ServiceRow>[] = [
    {
      id: 'name',
      header: 'Name',
      sortable: true,
      alwaysVisible: true,
      cell: (row) => (
        <div className="flex items-center gap-3">
          {row.image_url ? (
            <img src={row.image_url} alt="" className="size-8 rounded object-cover" />
          ) : (
            <div className="bg-sand size-8 rounded" />
          )}
          <div>
            <p>{row.name}</p>
            {row.sku ? <p className="text-ink-muted text-xs">{row.sku}</p> : null}
          </div>
        </div>
      ),
    },
    { id: 'category', header: 'Category', cell: (row) => row.category ?? '—' },
    {
      id: 'duration_min',
      header: 'Duration',
      sortable: true,
      cell: (row) => `${row.duration_min} min`,
    },
    {
      id: 'base_price',
      header: 'Price',
      sortable: true,
      cell: (row) => formatCurrency(row.base_price),
    },
    {
      id: 'is_active',
      header: 'Status',
      cell: (row) => (
        <div className="flex gap-1">
          <Badge variant={row.is_active ? 'accent' : 'outline'}>
            {row.is_active ? 'Active' : 'Inactive'}
          </Badge>
          {row.is_featured && <Badge variant="outline">Featured</Badge>}
        </div>
      ),
    },
    {
      id: 'actions',
      header: '',
      alwaysVisible: true,
      className: 'w-24 text-right',
      cell: (row) => <ServiceRowActions row={row} onEdit={setDialogTarget} />,
    },
  ];

  return (
    <>
      <Head title="Services" />
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-ink text-2xl font-medium">Services</h1>
            <p className="text-ink-muted text-sm">Every bookable service and its pricing.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <a href="/admin/services/export">
                <Download className="size-4" />
                Export
              </a>
            </Button>
            {services.total > 0 && (
              <Button
                variant="outline"
                className="text-red-600 hover:bg-red-50"
                onClick={deleteAllMatching}
              >
                <Trash2 className="size-4" />
                Delete all
              </Button>
            )}
            <Button onClick={() => setDialogTarget(null)}>
              <Plus className="size-4" />
              New service
            </Button>
          </div>
        </div>
        <DataTable<ServiceRow>
          columns={columns}
          rows={services.data}
          meta={services satisfies DataTablePaginationMeta}
          getRowId={(row) => row.id}
          filters={filters}
          bulkActions={[
            {
              label: 'Delete selected',
              variant: 'destructive',
              onAction: (selectedRows) => {
                if (confirm(`Delete ${selectedRows.length} selected service(s)?`)) {
                  router.post(
                    '/admin/services/bulk-delete',
                    { ids: selectedRows.map((row) => row.id) },
                    { preserveScroll: true },
                  );
                }
              },
            },
          ]}
          searchPlaceholder="Search services..."
          emptyTitle="No services yet"
          csvFilename="services.csv"
        />
      </div>

      {dialogTarget !== undefined && (
        <ServiceFormDialog
          key={dialogTarget?.id ?? 'new'}
          open={dialogTarget !== undefined}
          onOpenChange={(open) => {
            if (!open) {
              setDialogTarget(undefined);
            }
          }}
          service={dialogTarget}
          categories={categories}
          staff={staff}
        />
      )}
    </>
  );
}

Services.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
