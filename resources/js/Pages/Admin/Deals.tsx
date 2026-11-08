import { Head, router } from '@inertiajs/react';
import { Pencil, Plus, Trash2 } from 'lucide-react';
import * as React from 'react';

import {
  DataTable,
  type DataTableColumn,
  type DataTablePaginationMeta,
} from '@/Components/admin/DataTable';
import { DealFormDialog, type DealDialogRow } from '@/Components/admin/DealFormDialog';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import AdminLayout from '@/Layouts/AdminLayout';
import { formatCurrency } from '@/lib/currency';

interface DealRow extends DealDialogRow {
  redemptions_count: number;
}

interface DealsPageProps {
  deals: {
    data: DealRow[];
    current_page: number;
    last_page: number;
    per_page: number;
    total: number;
    from: number | null;
    to: number | null;
  };
  filters: { search: string | null; sort: string; direction: 'asc' | 'desc' };
  services: { id: number; name: string; base_price: string }[];
  categories: { id: number; name: string }[];
  categoryTags: string[];
}

function formatValue(deal: DealRow) {
  if (deal.type === 'percent') {
    return `${Number(deal.value)}%`;
  }

  return formatCurrency(deal.value);
}

function DealRowActions({ row, onEdit }: { row: DealRow; onEdit: (row: DealRow) => void }) {
  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      aria-label={`Edit ${row.title}`}
      onClick={() => onEdit(row)}
    >
      <Pencil className="size-3.5" />
      Edit
    </Button>
  );
}

export default function Deals({ deals, filters, services, categories, categoryTags }: DealsPageProps) {
  const [dialogTarget, setDialogTarget] = React.useState<DealRow | null | undefined>(undefined);

  function deleteAllMatching() {
    const scope = filters.search ? 'matching the current search' : 'ALL';
    if (confirm(`Delete ${scope} ${deals.total} deal(s)?`)) {
      router.post('/admin/deals/bulk-delete', {
        all: true,
        search: filters.search ?? undefined,
      });
    }
  }

  const columns: DataTableColumn<DealRow>[] = [
    {
      id: 'title',
      header: 'Deal',
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
            <p>{row.title}</p>
            {row.code ? <p className="text-ink-muted text-xs">{row.code}</p> : null}
          </div>
        </div>
      ),
    },
    {
      id: 'category_tag',
      header: 'Public tag',
      cell: (row) =>
        row.category_tag ? (
          <div className="flex flex-wrap items-center gap-1">
            <Badge variant="outline">{row.category_tag}</Badge>
            {row.is_top_deal && <Badge variant="accent">Pinned</Badge>}
          </div>
        ) : (
          <span className="text-ink-muted text-xs">Not shown publicly</span>
        ),
    },
    {
      id: 'type',
      header: 'Type',
      cell: (row) => (
        <div className="flex items-center gap-2">
          <Badge variant="outline">{row.type}</Badge>
          <span>{formatValue(row)}</span>
        </div>
      ),
    },
    {
      id: 'starts_at',
      header: 'Window',
      sortable: true,
      cell: (row) =>
        row.starts_at && row.ends_at
          ? `${new Date(row.starts_at).toLocaleDateString()} – ${new Date(row.ends_at).toLocaleDateString()}`
          : '—',
    },
    {
      id: 'flags',
      header: 'Flags',
      cell: (row) => (
        <div className="flex flex-wrap gap-1">
          {row.is_stackable && <Badge variant="outline">Stackable</Badge>}
          {row.is_auto_apply && <Badge variant="outline">Auto-apply</Badge>}
        </div>
      ),
    },
    {
      id: 'usage',
      header: 'Usage',
      cell: (row) => `${row.redemptions_count}${row.usage_limit ? ` / ${row.usage_limit}` : ''}`,
    },
    {
      id: 'is_active',
      header: 'Status',
      cell: (row) => <Badge variant={row.is_active ? 'accent' : 'outline'}>{row.is_active ? 'Active' : 'Inactive'}</Badge>,
    },
    {
      id: 'actions',
      header: '',
      alwaysVisible: true,
      className: 'w-24 text-right',
      cell: (row) => <DealRowActions row={row} onEdit={setDialogTarget} />,
    },
  ];

  return (
    <>
      <Head title="Deals" />
      <div className="space-y-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="font-display text-ink text-2xl font-medium">Deals</h1>
            <p className="text-ink-muted text-sm">Coupon codes, percent/fixed/bundle discounts.</p>
          </div>
          <div className="flex gap-2">
            {deals.total > 0 && (
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
              New deal
            </Button>
          </div>
        </div>
        <DataTable<DealRow>
          columns={columns}
          rows={deals.data}
          meta={deals satisfies DataTablePaginationMeta}
          getRowId={(row) => row.id}
          filters={filters}
          bulkActions={[
            {
              label: 'Delete selected',
              variant: 'destructive',
              onAction: (selectedRows) => {
                if (confirm(`Delete ${selectedRows.length} selected deal(s)?`)) {
                  router.post(
                    '/admin/deals/bulk-delete',
                    { ids: selectedRows.map((row) => row.id) },
                    { preserveScroll: true },
                  );
                }
              },
            },
          ]}
          searchPlaceholder="Search title or code..."
          emptyTitle="No deals yet"
          csvFilename="deals.csv"
        />
      </div>

      {dialogTarget !== undefined && (
        <DealFormDialog
          key={dialogTarget?.id ?? 'new'}
          open={dialogTarget !== undefined}
          onOpenChange={(open) => {
            if (!open) {
              setDialogTarget(undefined);
            }
          }}
          deal={dialogTarget}
          services={services}
          categories={categories}
          categoryTags={categoryTags}
        />
      )}
    </>
  );
}

Deals.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
