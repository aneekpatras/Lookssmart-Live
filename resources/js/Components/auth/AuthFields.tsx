import { usePage } from '@inertiajs/react';
import { Check, Circle, Eye, EyeOff } from 'lucide-react';
import * as React from 'react';

import { LoadingDots } from '@/Components/LoadingDots';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import { Label } from '@/Components/ui/label';

/** Same constants the server rule reads (App\Support\PasswordPolicy::forFrontend), shared by Inertia. */
interface PasswordPolicyProps {
  [key: string]: unknown;
  passwordPolicy: { min: number; uppercase: boolean; number: boolean };
}

/** A quick horizontal shake when a field has a new error (CSS only; skipped for reduced motion). */
export function shakeClass(error: string | undefined, token: number): string {
  return error && token > 0 ? 'motion-safe:animate-[field-shake_0.35s_ease-in-out]' : '';
}

/** Counts up whenever the server sends a (new) set of errors, so the shake can replay. */
export function useErrorToken(errors: Record<string, string | undefined>): number {
  const [token, setToken] = React.useState(0);
  const signature = Object.values(errors).filter(Boolean).join('|');
  React.useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (signature) setToken((value) => value + 1);
  }, [signature]);
  return token;
}

export function PasswordInput({
  id,
  label,
  value,
  onChange,
  error,
  autoComplete,
  autoFocus,
  token = 0,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (value: string) => void;
  error?: string;
  autoComplete: 'current-password' | 'new-password';
  autoFocus?: boolean;
  token?: number;
}) {
  const [shown, setShown] = React.useState(false);

  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <div key={error ? `${id}-${token}` : id} className={`relative ${shakeClass(error, token)}`}>
        <Input
          id={id}
          name={id}
          type={shown ? 'text' : 'password'}
          autoComplete={autoComplete}
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus={autoFocus}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          aria-invalid={!!error}
          className="pr-11"
          required
        />
        <button
          type="button"
          onClick={() => setShown((current) => !current)}
          className="text-ink-muted hover:text-ink focus-visible:ring-accent-500 absolute inset-y-0 right-0 flex w-11 items-center justify-center rounded-md focus-visible:ring-2 focus-visible:outline-none"
          aria-label={shown ? 'Hide password' : 'Show password'}
          aria-pressed={shown}
        >
          {shown ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
        </button>
      </div>
      {error ? <p className="text-sm text-red-600">{error}</p> : null}
    </div>
  );
}

function Rule({ met, children }: { met: boolean; children: React.ReactNode }) {
  return (
    <li
      className={`flex items-center gap-2 text-xs ${met ? 'text-emerald-700' : 'text-ink-muted'}`}
    >
      {met ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Circle className="size-3.5" aria-hidden="true" />
      )}
      <span>{children}</span>
      <span className="sr-only">{met ? '(done)' : '(not yet)'}</span>
    </li>
  );
}

/** Live checklist for the register password field; the three lines mirror the server rule exactly. */
export function PasswordChecklist({ password }: { password: string }) {
  const { passwordPolicy: policy } = usePage<PasswordPolicyProps>().props;

  return (
    <ul className="space-y-1" aria-label="Password requirements">
      <Rule met={password.length >= policy.min}>At least {policy.min} characters</Rule>
      {policy.uppercase && <Rule met={/\p{Lu}/u.test(password)}>One uppercase letter</Rule>}
      {policy.number && <Rule met={/\d/.test(password)}>One number</Rule>}
    </ul>
  );
}

export function MatchTick({ password, confirmation }: { password: string; confirmation: string }) {
  if (!confirmation) return null;
  const match = password === confirmation;

  return (
    <p
      className={`flex items-center gap-2 text-xs ${match ? 'text-emerald-700' : 'text-ink-muted'}`}
    >
      {match ? (
        <Check className="size-3.5" aria-hidden="true" />
      ) : (
        <Circle className="size-3.5" aria-hidden="true" />
      )}
      {match ? 'Passwords match' : 'Passwords do not match yet'}
    </p>
  );
}

/** Submit button: loading dots while sending, then a short success check. */
export function SubmitButton({
  processing,
  done,
  children,
}: {
  processing: boolean;
  done: boolean;
  children: React.ReactNode;
}) {
  return (
    <Button type="submit" className="w-full" disabled={processing || done}>
      {processing ? (
        <LoadingDots dotClassName="size-1.5" />
      ) : done ? (
        <Check className="size-4" aria-label="Done" />
      ) : (
        children
      )}
    </Button>
  );
}

/** Hidden spam trap: real visitors never see or fill it; bots usually do. Server rejects it silently. */
export function Honeypot({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <div className="absolute -left-[9999px] h-0 w-0 overflow-hidden" aria-hidden="true">
      <label>
        Leave this field empty
        <input
          type="text"
          name="website"
          tabIndex={-1}
          autoComplete="off"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
      </label>
    </div>
  );
}
