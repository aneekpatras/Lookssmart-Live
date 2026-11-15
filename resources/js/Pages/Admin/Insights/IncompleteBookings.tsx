import { Head, router } from '@inertiajs/react';
import { MessageCircle, Trash2 } from 'lucide-react';
import * as React from 'react';

import { formatWithRelative } from '@/lib/adminFormat';
import { displayPhone } from '@/lib/phone';
import { Badge } from '@/Components/ui/badge';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import AdminLayout from '@/Layouts/AdminLayout';

interface Row {
  id: number;
  name: string;
  phone: string;
  services: string;
  total: string | null;
  last_seen_at: string | null;
  status: string;
  whatsapp_url: string;
}

const statusVariant: Record<string, 'success' | 'warning' | 'outline'> = {
  new: 'warning',
  contacted: 'outline',
  converted: 'success',
};

export default function IncompleteBookings({ ready, rows }: { ready: boolean; rows: Row[] }) {
  return (
    <>
      <Head title="Incomplete bookings" />
      <div className="space-y-6">
        <div>
          <h1 className="font-display text-ink text-2xl font-medium">Incomplete bookings</h1>
          <p className="text-ink-muted mt-1 text-sm">
            People who left a name and phone number on the booking form but did not finish. The
            WhatsApp button opens a chat with a prepared message; nothing is sent automatically.
          </p>
        </div>

        {!ready ? (
          <Card>
            <CardContent className="p-6 text-sm">
              The tracking tables have not been created yet. Run the SQL first.
            </CardContent>
          </Card>
        ) : rows.length === 0 ? (
          <p className="text-ink-muted py-10 text-center text-sm">No incomplete bookings yet.</p>
        ) : (
          <div className="border-border-soft overflow-x-auto rounded-lg border bg-white">
            <table className="w-full text-left text-sm">
              <thead className="bg-accent-50 text-ink-muted">
                <tr>
                  <th className="p-3">Name</th>
                  <th className="p-3">Phone</th>
                  <th className="p-3">Services</th>
                  <th className="p-3">Total</th>
                  <th className="p-3">Last seen</th>
                  <th className="p-3">Status</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {rows.map((row) => (
                  <tr key={row.id} className="border-border-soft border-t align-top">
                    <td className="p-3">{row.name}</td>
                    <td className="p-3 whitespace-nowrap">{displayPhone(row.phone)}</td>
                    <td className="p-3">{row.services || '—'}</td>
                    <td className="p-3 whitespace-nowrap">
                      {row.total ? `Rs. ${Number(row.total).toLocaleString()}` : '—'}
                    </td>
                    <td className="p-3 whitespace-nowrap">
                      {formatWithRelative(row.last_seen_at)}
                    </td>
                    <td className="p-3">
                      <Badge variant={statusVariant[row.status] ?? 'outline'}>{row.status}</Badge>
                    </td>
                    <td className="p-3">
                      <div className="flex items-center gap-1">
                        <Button asChild size="sm" variant="outline">
                          <a
                            href={row.whatsapp_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            onClick={() =>
                              router.post(
                                `/admin/incomplete-bookings/${row.id}/contacted`,
                                {},
                                { preserveScroll: true },
                              )
                            }
                          >
                            <MessageCircle aria-hidden="true" /> WhatsApp
                          </a>
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          aria-label={`Delete ${row.name}`}
                          onClick={() => {
                            if (confirm(`Delete this entry for ${row.name}?`)) {
                              router.delete(`/admin/incomplete-bookings/${row.id}`, {
                                preserveScroll: true,
                              });
                            }
                          }}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </>
  );
}

IncompleteBookings.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
