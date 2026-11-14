import { Head, Link, useForm } from '@inertiajs/react';
import * as React from 'react';

import {
  Honeypot,
  MatchTick,
  PasswordChecklist,
  PasswordInput,
  SubmitButton,
  shakeClass,
  useErrorToken,
} from '@/Components/auth/AuthFields';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import AuthLayout from '@/Layouts/AuthLayout';

export default function Register() {
  // No remember key on this form: passwords are never kept in Inertia's form history.
  const { data, setData, post, processing, errors, reset } = useForm({
    name: '',
    email: '',
    password: '',
    password_confirmation: '',
    website: '',
  });
  const [done, setDone] = React.useState(false);
  const token = useErrorToken(errors);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    post('/register', {
      onSuccess: () => setDone(true),
      onFinish: () => reset('password', 'password_confirmation'),
    });
  }

  return (
    <>
      <Head title="Create an account" />

      <form onSubmit={submit} className="space-y-4">
        <Honeypot value={data.website} onChange={(value) => setData('website', value)} />

        <div className="space-y-1.5">
          <Label htmlFor="name">Name</Label>
          <div
            key={errors.name ? `name-${token}` : 'name'}
            className={shakeClass(errors.name, token)}
          >
            <Input
              id="name"
              name="name"
              autoComplete="name"
              // eslint-disable-next-line jsx-a11y/no-autofocus
              autoFocus
              value={data.name}
              onChange={(e) => setData('name', e.target.value)}
              aria-invalid={!!errors.name}
              required
            />
          </div>
          {errors.name ? <p className="text-sm text-red-600">{errors.name}</p> : null}
        </div>

        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <div
            key={errors.email ? `email-${token}` : 'email'}
            className={shakeClass(errors.email, token)}
          >
            <Input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              value={data.email}
              onChange={(e) => setData('email', e.target.value)}
              aria-invalid={!!errors.email}
              required
            />
          </div>
          {errors.email ? <p className="text-sm text-red-600">{errors.email}</p> : null}
        </div>

        <div className="space-y-2">
          <PasswordInput
            id="password"
            label="Password"
            autoComplete="new-password"
            value={data.password}
            onChange={(value) => setData('password', value)}
            error={errors.password}
            token={token}
          />
          <PasswordChecklist password={data.password} />
        </div>

        <div className="space-y-2">
          <PasswordInput
            id="password_confirmation"
            label="Confirm password"
            autoComplete="new-password"
            value={data.password_confirmation}
            onChange={(value) => setData('password_confirmation', value)}
          />
          <MatchTick password={data.password} confirmation={data.password_confirmation} />
        </div>

        <SubmitButton processing={processing} done={done}>
          Create account
        </SubmitButton>

        <p className="text-ink-muted text-center text-sm">
          Already have an account?{' '}
          <Link href="/login" className="text-accent-700 hover:underline">
            Log in
          </Link>
        </p>
      </form>
    </>
  );
}

Register.layout = (page: React.ReactNode) => (
  <AuthLayout title="Create your account" description="Book faster and track your visit history.">
    {page}
  </AuthLayout>
);
