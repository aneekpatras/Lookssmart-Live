import { Head, Link, usePage } from '@inertiajs/react';
import { CalendarCheck, Home, MessageCircle, Scissors } from 'lucide-react';
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

const CARDS = [
  {
    label: 'Hair',
    tone: 'bg-tint-a',
    place: 'sm:top-2 sm:left-[3%] sm:-rotate-6',
    mobile: '-rotate-3',
  },
  {
    label: 'Skin',
    tone: 'bg-tint-b',
    place: 'sm:top-10 sm:right-[4%] sm:rotate-6',
    mobile: 'rotate-2',
  },
  {
    label: 'Bridal',
    tone: 'bg-accent-100',
    place: 'sm:top-[36%] sm:left-0 sm:rotate-3',
    mobile: 'rotate-3',
  },
  {
    label: 'Makeup',
    tone: 'bg-tint-c',
    place: 'sm:top-[42%] sm:right-0 sm:-rotate-3',
    mobile: '-rotate-2',
  },
  {
    label: 'Waxing',
    tone: 'bg-cream',
    place: 'sm:bottom-12 sm:left-[7%] sm:rotate-6',
    mobile: 'rotate-1',
  },
  {
    label: 'Spa',
    tone: 'bg-tint-d',
    place: 'sm:bottom-6 sm:right-[8%] sm:-rotate-6',
    mobile: '-rotate-3',
  },
  {
    label: 'Nails',
    tone: 'bg-accent-50',
    place: 'sm:bottom-0 sm:left-[42%] sm:-rotate-2',
    mobile: 'rotate-2',
  },
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

      <section className="relative overflow-x-clip px-6 py-14 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-5xl">
          {/* Stage: on phones everything stacks; from sm up the cards are scattered around the 404. */}
          <div className="relative flex flex-col items-center text-center sm:min-h-[40rem] sm:justify-center">
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
              The link may be old, or the page may have moved. Let&apos;s get you back to something
              beautiful.
            </p>

            <div className="relative z-10 mt-7 flex w-full flex-col items-center justify-center gap-3 sm:w-auto sm:flex-row">
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

            {/* sm:contents lets the cards position against the stage above; on phones they wrap in a row. */}
            <ul className="mt-10 flex flex-wrap justify-center gap-3 sm:contents">
              {CARDS.map((card) => (
                <li key={card.label} className={`${card.place} sm:absolute`}>
                  <Link
                    href="/services"
                    className={`${card.tone} ${card.mobile} border-accent-300/60 text-ink font-display hover:border-accent-500 focus-visible:ring-accent-500 inline-block rounded-2xl border px-5 py-4 text-lg shadow-sm transition-transform outline-none focus-visible:ring-2 motion-safe:hover:-translate-y-1 sm:rotate-0`}
                  >
                    {card.label}
                  </Link>
                </li>
              ))}
            </ul>
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
              <MessageCircle className="size-4 text-accent-700" aria-hidden="true" />
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
