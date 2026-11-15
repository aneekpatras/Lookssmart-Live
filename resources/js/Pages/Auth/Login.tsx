import { Head, Link, useForm } from '@inertiajs/react';
import * as React from 'react';

import {
  PasswordInput,
  SubmitButton,
  shakeClass,
  useErrorToken,
} from '@/Components/auth/AuthFields';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import AuthLayout from '@/Layouts/AuthLayout';

export default function Login({ status }: { status?: string }) {
  // No remember key on this form: passwords are never kept in Inertia's form history.
  const { data, setData, post, processing, errors, reset } = useForm({
    email: '',
    password: '',
    remember: false as boolean,
  });
  const [done, setDone] = React.useState(false);
  const token = useErrorToken(errors);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    post('/login', {
      onSuccess: () => setDone(true),
      onFinish: () => reset('password'),
    });
  }

  return (
    <>
      <Head title="Log in" />
      {status ? <p className="mb-4 text-sm text-emerald-600">{status}</p> : null}

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Phone number or email</Label>
          <div
            key={errors.email ? `email-${token}` : 'email'}
            className={shakeClass(errors.email, token)}
          >
            <Input
              id="email"
              name="email"
              type="text"
              inputMode="email"
              placeholder="03XX XXXXXXX or you@example.com"
              // "username" is what password managers pair with the password field.
              autoComplete="username"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={data.email}
              onChange={(e) => setData('email', e.target.value)}
              aria-invalid={!!errors.email}
              required
            />
          </div>
          {errors.email ? <p className="text-sm text-red-600">{errors.email}</p> : null}
        </div>

        <PasswordInput
          id="password"
          label="Password"
          autoComplete="current-password"
          value={data.password}
          onChange={(value) => setData('password', value)}
          error={errors.password}
          token={token}
        />

        <label className="text-ink-muted flex min-h-10 items-center gap-2 text-sm">
          <input
            type="checkbox"
            className="border-border-soft size-4 rounded"
            checked={data.remember}
            onChange={(e) => setData('remember', e.target.checked)}
          />
          Remember me
        </label>

        <SubmitButton processing={processing} done={done}>
          Log in
        </SubmitButton>

        <div className="flex items-center justify-between text-sm">
          <Link href="/register" className="text-accent-700 hover:underline">
            Create an account
          </Link>
          <Link href="/forgot-password" className="text-ink-muted hover:underline">
            Forgot password?
          </Link>
        </div>
      </form>
    </>
  );
}

Login.layout = (page: React.ReactNode) => (
  <AuthLayout title="Welcome back" description="Log in to manage your bookings.">
    {page}
  </AuthLayout>
);
