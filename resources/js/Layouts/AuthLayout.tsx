import { Link } from '@inertiajs/react';
import * as React from 'react';

import { Toaster } from '@/Components/ui/toaster';

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
    <div className="bg-ivory flex min-h-screen items-center justify-center px-4 py-12">
      <Toaster />
      <div className="glass auth-card-in w-full max-w-md rounded-2xl p-8">
        <Link href="/" className="font-display text-ink text-lg font-medium">
          Looks Smart
        </Link>

        <div className="mt-6 space-y-1.5">
          <h1 className="font-display text-ink text-2xl font-medium">{title}</h1>
          {description ? <p className="text-ink-muted text-sm">{description}</p> : null}
        </div>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
