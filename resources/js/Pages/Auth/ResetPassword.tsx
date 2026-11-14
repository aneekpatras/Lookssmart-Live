import { Head, useForm } from '@inertiajs/react';
import * as React from 'react';

import { PasswordInput, SubmitButton, useErrorToken } from '@/Components/auth/AuthFields';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';
import AuthLayout from '@/Layouts/AuthLayout';

export default function ResetPassword({ email, token }: { email: string; token: string }) {
  // No remember key on this form: passwords are never kept in Inertia's form history.
  const { data, setData, post, processing, errors, reset } = useForm({
    token,
    email,
    password: '',
    password_confirmation: '',
  });
  const [done, setDone] = React.useState(false);
  const errorToken = useErrorToken(errors);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    post('/reset-password', {
      onSuccess: () => setDone(true),
      onFinish: () => reset('password', 'password_confirmation'),
    });
  }

  return (
    <>
      <Head title="Reset password" />

      <form onSubmit={submit} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="email">Email</Label>
          <Input id="email" type="email" autoComplete="email" value={data.email} disabled />
        </div>

        <div className="space-y-1.5">
          <PasswordInput
            id="password"
            label="New password"
            autoComplete="new-password"
            // eslint-disable-next-line jsx-a11y/no-autofocus
            autoFocus
            value={data.password}
            onChange={(value) => setData('password', value)}
            error={errors.password}
            token={errorToken}
          />
          <p className="text-ink-muted text-xs">
            At least 8 characters with one uppercase letter and one number. Staff accounts need 12
            characters.
          </p>
        </div>

        <PasswordInput
          id="password_confirmation"
          label="Confirm new password"
          autoComplete="new-password"
          value={data.password_confirmation}
          onChange={(value) => setData('password_confirmation', value)}
        />

        <SubmitButton processing={processing} done={done}>
          Reset password
        </SubmitButton>
      </form>
    </>
  );
}

ResetPassword.layout = (page: React.ReactNode) => (
  <AuthLayout title="Set a new password">{page}</AuthLayout>
);
