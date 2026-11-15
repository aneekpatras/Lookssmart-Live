import { Head, Link, usePage } from '@inertiajs/react';
import { CalendarCheck, Home, MessageCircle, Sparkles } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/Components/ui/button';
import PublicLayout from '@/Layouts/PublicLayout';

const QUICK_LINKS = [
  { label: 'Services', href: '/services' },
  { label: 'Deals', href: '/deals' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Contact', href: '/contact' },
];

/** Public 404 (served with a real HTTP 404 status by bootstrap/app.php). Noindex, no canonical. */
export default function NotFound() {
  const { site } = usePage<{ [key: string]: unknown; site?: { whatsapp_url?: string } }>().props;
  const whatsapp = site?.whatsapp_url ?? 'https://wa.me/923059833859';

  return (
    <>
      <Head title="Page not found | Looks Smart Beauty Salon">
        {/* eslint-disable-next-line react/no-unknown-property */}
        <meta head-key="robots" name="robots" content="noindex,follow" />
      </Head>

      <section className="px-6 py-14 lg:px-10 lg:py-20">
        <div className="mx-auto flex max-w-xl flex-col items-center text-center">
          <div
            aria-hidden="true"
            className="bg-ink relative h-[186px] w-[150px] rounded-t-full rounded-b-lg border-[1.5px] border-[#c9a66b] motion-safe:animate-[auth-rise_0.5s_ease-out_both]"
          >
            <div className="absolute inset-[7px] rounded-t-full rounded-b-md border border-[#c9a66b]/40" />
            <div className="relative flex h-full flex-col items-center justify-center gap-1">
              <Sparkles className="text-accent-500 size-5" />
              <span className="font-display text-accent-500 text-[46px] leading-none font-medium">
                404
              </span>
              <span className="text-ivory/60 mt-1 text-[10px] tracking-[0.22em] uppercase">
                Not found
              </span>
            </div>
          </div>

          <h1 className="font-display text-ink mt-8 text-3xl font-medium sm:text-4xl">
            This page isn&apos;t here
          </h1>
          <p className="text-ink-muted mt-3 max-w-md text-base leading-7">
            The link may be old, or the page may have moved. Let&apos;s get you back to something
            beautiful.
          </p>

          <div className="mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
            <Button asChild variant="accent" size="lg" className="w-full sm:w-auto">
              <Link href="/">
                <Home aria-hidden="true" /> Back to home
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
              <Link href="/book">
                <CalendarCheck aria-hidden="true" /> Book now
              </Link>
            </Button>
          </div>

          <p className="text-ink-muted mt-10 text-xs tracking-[0.18em] uppercase">
            Or try one of these
          </p>
          <ul className="mt-3 flex flex-wrap justify-center gap-2">
            {QUICK_LINKS.map((link) => (
              <li key={link.href}>
                <Link
                  href={link.href}
                  className="border-border-soft text-ink hover:border-accent-500 inline-flex min-h-10 items-center rounded-full border px-4 text-sm transition-colors"
                >
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>

          <p className="text-ink-muted mt-8 flex flex-wrap items-center justify-center gap-2 text-sm">
            <MessageCircle className="size-4 text-[#25D366]" aria-hidden="true" />
            Can&apos;t find what you need?
            <a
              href={whatsapp}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-700 font-medium underline-offset-2 hover:underline"
            >
              Message us on WhatsApp
            </a>
          </p>
        </div>
      </section>
    </>
  );
}

NotFound.layout = (page: React.ReactNode) => <PublicLayout solidHeader>{page}</PublicLayout>;
