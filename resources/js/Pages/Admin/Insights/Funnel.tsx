import { Head, router } from '@inertiajs/react';
import * as React from 'react';

import { Card, CardContent } from '@/Components/ui/card';
import AdminLayout from '@/Layouts/AdminLayout';

interface Step {
  key: string;
  label: string;
  sessions: number;
  dropoff: number | null;
}

interface FunnelProps {
  ready: boolean;
  days: number;
  steps: Step[];
  top: { name: string; kind: string; sessions: number }[];
}

export default function Funnel({ ready, days, steps, top }: FunnelProps) {
  const max = Math.max(1, ...steps.map((step) => step.sessions));

  return (
    <>
      <Head title="Visitor funnel" />
      <div className="space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="font-display text-ink text-2xl font-medium">Visitor funnel</h1>
            <p className="text-ink-muted mt-1 text-sm">
              Anonymous visits only: unique browsers at each step, no names or personal details.
              Data older than 90 days is removed automatically.
            </p>
          </div>
          <div role="group" aria-label="Date range" className="flex gap-2">
            {[7, 30].map((value) => (
              <button
                key={value}
                type="button"
                aria-pressed={days === value}
                onClick={() =>
                  router.get('/admin/funnel', { days: value }, { preserveState: true })
                }
                className={`rounded-full border px-4 py-2 text-sm ${
                  days === value
                    ? 'border-ink bg-ink text-ivory'
                    : 'border-border-soft text-ink-muted hover:border-accent-500'
                }`}
              >
                Last {value} days
              </button>
            ))}
          </div>
        </div>

        {!ready ? (
          <Card>
            <CardContent className="p-6 text-sm">
              The tracking tables have not been created yet. Run the SQL first.
            </CardContent>
          </Card>
        ) : (
          <>
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {steps.map((step) => (
                <Card key={step.key}>
                  <CardContent className="p-4">
                    <p className="text-ink-muted text-xs">{step.label}</p>
                    <p className="font-display text-ink mt-1 text-3xl font-medium">
                      {step.sessions}
                    </p>
                    <p className="text-ink-muted mt-1 text-xs">
                      {step.dropoff === null
                        ? 'First step'
                        : `${step.dropoff}% dropped off from the step before`}
                    </p>
                  </CardContent>
                </Card>
              ))}
            </div>

            <Card>
              <CardContent className="space-y-3 p-4">
                {steps.map((step) => (
                  <div key={step.key}>
                    <div className="flex justify-between text-sm">
                      <span>{step.label}</span>
                      <span className="text-ink-muted">{step.sessions} sessions</span>
                    </div>
                    <progress
                      className="[&::-moz-progress-bar]:bg-accent-500 [&::-webkit-progress-bar]:bg-accent-50 [&::-webkit-progress-value]:bg-accent-500 mt-1 h-2 w-full overflow-hidden rounded-full"
                      value={step.sessions}
                      max={max}
                      aria-label={`${step.label}: ${step.sessions} sessions`}
                    />
                  </div>
                ))}
              </CardContent>
            </Card>

            <div>
              <h2 className="font-display text-ink text-lg font-medium">Top 10 added to cart</h2>
              {top.length === 0 ? (
                <p className="text-ink-muted mt-2 text-sm">
                  Nothing added to a cart in this period.
                </p>
              ) : (
                <ol className="mt-3 space-y-1.5">
                  {top.map((row, index) => (
                    <li
                      key={`${row.kind}-${row.name}`}
                      className="border-border-soft flex items-center justify-between rounded-lg border bg-white px-4 py-2 text-sm"
                    >
                      <span>
                        {index + 1}. {row.name}{' '}
                        <span className="text-ink-muted text-xs">({row.kind})</span>
                      </span>
                      <span className="text-ink-muted">{row.sessions} sessions</span>
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </>
        )}
      </div>
    </>
  );
}

Funnel.layout = (page: React.ReactNode) => <AdminLayout>{page}</AdminLayout>;
