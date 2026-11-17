import { Head, Link, usePage } from '@inertiajs/react';
import { CalendarCheck, Home, MessageCircle, RotateCcw, Scissors } from 'lucide-react';
import * as React from 'react';

import { FallingCards } from '@/Components/FallingCards';
import { Button } from '@/Components/ui/button';
import PublicLayout from '@/Layouts/PublicLayout';

const QUICK_LINKS = [
  { label: 'Services', href: '/services' },
  { label: 'Deals', href: '/deals' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Contact', href: '/contact' },
];

/**
 * Public 404 (served with a real HTTP 404 status by bootstrap/app.php). Noindex, no canonical.
 *
 * The cards start as a static arrangement resting at the bottom of the stage (that is what the server
 * renders, what reduced-motion visitors keep, and what stays if matter-js fails to load). Otherwise
 * matter-js is imported dynamically (this page only), the static layout is swapped for the physics
 * layout, and the cards rain down from the top and can be dragged and thrown.
 */
export default function NotFound() {
  const { site } = usePage<{ [key: string]: unknown; site?: { whatsapp_url?: string } }>().props;
  const whatsapp = site?.whatsapp_url ?? 'https://wa.me/923059833859';

  const [respawnKey, setRespawnKey] = React.useState(0);
  const [physics, setPhysics] = React.useState(false);

  return (
    <>
      <Head title="Page not found | Looks Smart Beauty Salon">
        {/* eslint-disable-next-line react/no-unknown-property */}
        <meta head-key="robots" name="robots" content="noindex,follow" />
      </Head>

      <section className="px-6 py-8 lg:px-10 lg:py-12">
        <div className="mx-auto max-w-5xl">
          {/* Stage: the cards live in this box; the text sits above them and lets pointers through. */}
          <div className="relative min-h-[max(70svh,560px)] overflow-hidden rounded-3xl">
            <FallingCards respawnKey={respawnKey} onPhysicsChange={setPhysics} />

            <div className="pointer-events-none relative z-10 flex min-h-[inherit] flex-col items-center justify-center px-2 py-10 text-center">
              <p
                aria-hidden="true"
                className="font-display text-accent-500 text-[7rem] leading-none font-medium select-none sm:text-[11rem] lg:text-[15rem]"
              >
                404
              </p>
              <h1 className="font-display text-ink -mt-2 text-3xl font-medium sm:text-4xl">
                Page not found
              </h1>
              <p className="text-ink-muted mt-3 max-w-md text-base leading-7">
                The link may be old, or the page may have moved. Let&apos;s get you back to
                something beautiful.
              </p>

              <div className="pointer-events-auto mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
                <Button asChild variant="accent" size="lg" className="w-full sm:w-auto">
                  <Link href="/">
                    <Home aria-hidden="true" /> Back to home
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link href="/services">
                    <Scissors aria-hidden="true" /> View services
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link href="/book">
                    <CalendarCheck aria-hidden="true" /> Book appointment
                  </Link>
                </Button>
              </div>

              {physics && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="pointer-events-auto mt-4"
                  onClick={() => setRespawnKey((k) => k + 1)}
                >
                  <RotateCcw aria-hidden="true" /> Drop them again
                </Button>
              )}
            </div>
          </div>

          <div className="mx-auto flex max-w-xl flex-col items-center text-center">
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
              <MessageCircle className="text-accent-700 size-4" aria-hidden="true" />
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
        </div>
      </section>
    </>
  );
}

NotFound.layout = (page: React.ReactNode) => <PublicLayout solidHeader>{page}</PublicLayout>;
