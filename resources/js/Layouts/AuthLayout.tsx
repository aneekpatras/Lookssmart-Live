import { Link } from '@inertiajs/react';
import * as React from 'react';

import { Toaster } from '@/Components/ui/toaster';

/**
 * Sign-in / register shell: ivory page, no blur. On desktop a split layout (a brand panel built from
 * CSS only on the left, the form card on the right); on phones just the card.
 */
export default function AuthLayout({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="bg-ivory min-h-screen lg:grid lg:grid-cols-2">
      <Toaster />

      <aside className="bg-ink text-ivory relative hidden overflow-hidden lg:flex lg:flex-col lg:justify-between lg:p-14">
        <div
          aria-hidden="true"
          className="absolute inset-0 bg-[radial-gradient(circle_at_1px_1px,rgb(201_166_107/0.28)_1px,transparent_0)] bg-[length:26px_26px]"
        />
        <div
          aria-hidden="true"
          className="absolute -right-24 -bottom-24 size-[28rem] rounded-full bg-[radial-gradient(closest-side,rgb(201_166_107/0.35),transparent)]"
        />
        <Link href="/" className="font-display relative text-xl font-medium">
          Looks Smart
        </Link>
        <div className="relative max-w-md">
          <span className="bg-accent-500 mb-6 block h-0.5 w-14 rounded-full" aria-hidden="true" />
          <p className="font-display text-4xl leading-tight font-medium text-balance">
            Looks Smart Beauty Salon
          </p>
          <p className="text-ivory/70 mt-4 text-base leading-7">
            Precision hair styling, signature makeup artistry, and personal consultation — in the
            heart of Lahore.
          </p>
        </div>
        <p className="text-ivory/50 relative text-xs">Women-only salon</p>
      </aside>

      <main className="flex min-h-screen items-center justify-center px-4 py-10 lg:min-h-0">
        <div className="auth-card-in border-border-soft shadow-soft w-full max-w-md rounded-2xl border bg-white p-6 sm:p-8">
          <Link href="/" className="font-display text-ink text-lg font-medium lg:hidden">
            Looks Smart
          </Link>

          <div className="mt-6 space-y-1.5 lg:mt-0">
            <h1 className="font-display text-ink text-2xl font-medium">{title}</h1>
            {description ? <p className="text-ink-muted text-sm">{description}</p> : null}
          </div>

          <div className="mt-6">{children}</div>
        </div>
      </main>
    </div>
  );
}
