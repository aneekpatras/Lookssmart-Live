import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft, CalendarCheck, ShieldCheck, Sparkles, Zap } from 'lucide-react';
import * as React from 'react';

import { Toaster } from '@/Components/ui/toaster';

const PERKS = [
  { icon: CalendarCheck, text: 'Your bookings in one place' },
  { icon: Zap, text: 'Faster checkout next time' },
  { icon: ShieldCheck, text: 'Your details stay private' },
];

/** Log in / Create account switch: two real links that keep the query string (from / return URL). */
function AuthToggle({ url }: { url: string }) {
  const [path, query] = url.split('?');
  const search = query ? `?${query}` : '';
  const options = [
    { label: 'Log in', href: '/login' },
    { label: 'Create account', href: '/register' },
  ];

  return (
    <nav
      aria-label="Log in or create an account"
      className="bg-accent-50 grid grid-cols-2 gap-1 rounded-full p-1"
    >
      {options.map((option) => {
        const active = path === option.href;

        return (
          <Link
            key={option.href}
            href={`${option.href}${search}`}
            preserveScroll
            aria-current={active ? 'page' : undefined}
            className={`focus-visible:ring-accent-500 flex min-h-10 items-center justify-center rounded-full px-3 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none ${
              active ? 'bg-ink text-ivory' : 'text-ink-muted hover:text-ink'
            }`}
          >
            {option.label}
          </Link>
        );
      })}
    </nav>
  );
}

/**
 * Sign-in / register shell. Desktop: ONE row with the form card on the ivory left and a CSS-only espresso
 * brand panel on the right. Below lg: the card only, under a slim espresso brand strip. No blur, no overlay.
 * (Toaster is rendered outside the grid on purpose: inside it, it took a grid cell and pushed the panel and
 * the card onto different rows.)
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
  const { url } = usePage();
  const path = url.split('?')[0];
  const showToggle = path === '/login' || path === '/register';

  return (
    <>
      <Toaster />
      <div className="bg-ivory min-h-dvh lg:grid lg:grid-cols-2">
        <div className="flex min-h-dvh flex-col lg:min-h-0">
          <div className="bg-ink text-ivory flex items-center justify-center gap-2 px-4 py-3 lg:hidden">
            <Sparkles className="text-accent-500 size-4" aria-hidden="true" />
            <span className="font-display text-sm font-medium">Looks Smart Beauty Salon</span>
          </div>

          <div className="relative flex flex-1 items-center justify-center px-4 py-8 lg:py-12">
            <Link
              href="/"
              className="text-ink-muted hover:text-ink focus-visible:ring-accent-500 absolute top-4 left-4 hidden min-h-10 items-center gap-1.5 rounded-md px-2 text-sm focus-visible:ring-2 focus-visible:outline-none lg:inline-flex"
            >
              <ArrowLeft className="size-4" aria-hidden="true" /> Back to site
            </Link>

            <div className="border-border-soft shadow-soft w-full max-w-[380px] rounded-2xl border bg-white p-5 sm:p-7">
              {showToggle && <AuthToggle url={url} />}

              <div
                key={path}
                className="motion-safe:animate-[auth-swap_0.2s_ease-out_both] [&>*]:min-w-0"
              >
                <div className={`space-y-1.5 ${showToggle ? 'mt-6' : ''}`}>
                  <h1 className="font-display text-ink text-2xl font-medium">{title}</h1>
                  {description ? <p className="text-ink-muted text-sm">{description}</p> : null}
                </div>
                <div className="mt-6">{children}</div>
              </div>
            </div>
          </div>
        </div>

        <aside className="bg-ink text-ivory relative hidden items-center justify-center overflow-hidden lg:flex">
          <div
            aria-hidden="true"
            className="absolute -top-32 -right-32 size-[34rem] rounded-full bg-[radial-gradient(closest-side,rgb(201_166_107/0.30),transparent)]"
          />
          <div className="relative flex flex-col items-center px-10">
            <div className="relative h-[190px] w-[150px] rounded-t-full rounded-b-lg border-[1.5px] border-accent-500 bg-white/[0.04] motion-safe:animate-[auth-rise_0.5s_ease-out_both]">
              <div
                aria-hidden="true"
                className="absolute inset-[7px] rounded-t-full rounded-b-md border border-accent-500/40"
              />
              <div className="relative flex h-full flex-col items-center justify-center gap-3 px-4 text-center">
                <Sparkles className="text-accent-500 size-7" aria-hidden="true" />
                <p className="font-display text-ivory text-base leading-snug font-medium">
                  Looks Smart Beauty Salon
                </p>
              </div>
            </div>

            <ul className="mt-10 space-y-4">
              {PERKS.map(({ icon: Icon, text }, index) => (
                <li
                  key={text}
                  className={`text-ivory/80 flex items-center gap-3 text-sm motion-safe:animate-[auth-rise_0.5s_ease-out_both] ${
                    [
                      'motion-safe:[animation-delay:150ms]',
                      'motion-safe:[animation-delay:280ms]',
                      'motion-safe:[animation-delay:410ms]',
                    ][index]
                  }`}
                >
                  <Icon className="text-accent-500 size-5 shrink-0" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          </div>
        </aside>
      </div>
    </>
  );
}
