import { Head, Link, router, useForm } from '@inertiajs/react';
import * as React from 'react';

import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import AuthLayout from '@/Layouts/AuthLayout';

interface Props {
  email: string | null;
  expiresInMinutes: number;
  cooldownSeconds: number;
  status: string | null;
  wrongBrowser?: boolean;
}

/** Second step of admin sign-in: the 6-digit code that was emailed (or the approve link, in this browser). */
export default function AdminVerify({ email, expiresInMinutes, cooldownSeconds, status, wrongBrowser }: Props) {
  const { data, setData, post, processing, errors } = useForm({ code: '' });
  const [cooldown, setCooldown] = React.useState(cooldownSeconds);

  React.useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((c) => c - 1), 1000);

    return () => window.clearTimeout(timer);
  }, [cooldown]);

  if (wrongBrowser) {
    return (
      <>
        <Head title="Open this link in the same browser" />
        <p className="text-ink text-sm leading-6">
          Open this link in the browser where you signed in. Nothing has been approved.
        </p>
        <Link href="/login" className="text-accent-700 mt-4 inline-block text-sm font-medium hover:underline">
          Back to login
        </Link>
      </>
    );
  }

  function submit(event: React.FormEvent) {
    event.preventDefault();
    post('/admin-verify');
  }

  function resend() {
    router.post(
      '/admin-verify/resend',
      {},
      {
        preserveScroll: true,
        onSuccess: () => setCooldown(cooldownSeconds),
      },
    );
  }

  return (
    <>
      <Head title="Enter your sign-in code" />

      <form onSubmit={submit} className="space-y-4">
        <p className="text-ink-muted text-sm">
          We emailed a 6-digit code to <span className="text-ink font-medium">{email}</span>. It
          expires in {expiresInMinutes} minutes.
        </p>

        {status && <p className="text-sm text-green-700">{status}</p>}

        <div className="space-y-1.5">
          <Label htmlFor="code">6-digit code</Label>
          <Input
            id="code"
            name="code"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]*"
            maxLength={6}
            value={data.code}
            onChange={(e) => setData('code', e.target.value.replace(/\D/g, '').slice(0, 6))}
            aria-invalid={!!errors.code}
            required
          />
          {errors.code && <p className="text-sm text-red-600">{errors.code}</p>}
        </div>

        <Button type="submit" className="w-full" disabled={processing || data.code.length !== 6}>
          Verify
        </Button>

        <div className="flex items-center justify-between text-sm">
          <button
            type="button"
            onClick={resend}
            disabled={cooldown > 0}
            className="text-accent-700 font-medium hover:underline disabled:cursor-not-allowed disabled:opacity-50 disabled:no-underline"
          >
            {cooldown > 0 ? `Resend code (${cooldown}s)` : 'Resend code'}
          </button>
          <button
            type="button"
            onClick={() => router.post('/admin-verify/cancel')}
            className="text-ink-muted hover:underline"
          >
            Back to login
          </button>
        </div>
      </form>
    </>
  );
}

AdminVerify.layout = (page: React.ReactNode) => (
  <AuthLayout title="Check your email" description="One more step to sign in to the admin panel.">
    {page}
  </AuthLayout>
);
