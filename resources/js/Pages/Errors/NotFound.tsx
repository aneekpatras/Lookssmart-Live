import { Head, Link, usePage } from '@inertiajs/react';
import {
  Brush,
  CalendarCheck,
  Flower2,
  Gem,
  Hand,
  Heart,
  Home,
  type LucideIcon,
  MessageCircle,
  RotateCcw,
  Scissors,
  Smile,
  Sparkles,
} from 'lucide-react';
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

/**
 * Decorative cards that fall and can be played with (see lib/cardPhysics.ts). Labels are real salon
 * categories. Colours are theme tokens only (admin theme changes apply); text is espresso or ivory,
 * whichever reads on the card (ivory on the gold card would be too faint, so that one uses espresso).
 * `show` keeps 5 cards on phones, 6 from md and 8 from lg. `spot` is the resting place of the static
 * layout (server-rendered HTML, reduced motion), `rest` its tilt.
 */
const CARDS: {
  label: string;
  Icon: LucideIcon;
  tone: string;
  size: string;
  show: string;
  spot: string;
}[] = [
  {
    label: 'Hair',
    Icon: Scissors,
    tone: 'bg-accent-500 text-ink border-accent-500',
    size: 'h-[104px] w-[84px] md:h-[120px] md:w-[96px] lg:h-[132px] lg:w-[108px]',
    show: 'flex',
    spot: 'bottom-3 left-[3%] -rotate-6',
  },
  {
    label: 'Skin',
    Icon: Sparkles,
    tone: 'bg-ink text-ivory border-ink',
    size: 'h-[112px] w-[88px] md:h-[124px] md:w-[100px] lg:h-[140px] lg:w-[112px]',
    show: 'flex',
    spot: 'bottom-3 left-[18%] rotate-3',
  },
  {
    label: 'Bridal',
    Icon: Heart,
    tone: 'bg-accent-100 text-ink border-accent-300',
    size: 'h-[108px] w-[92px] md:h-[120px] md:w-[104px] lg:h-[132px] lg:w-[120px]',
    show: 'flex',
    spot: 'bottom-3 left-[36%] -rotate-3',
  },
  {
    label: 'Makeup',
    Icon: Brush,
    tone: 'bg-accent-300 text-ink border-accent-300',
    size: 'h-[100px] w-[88px] md:h-[116px] md:w-[100px] lg:h-[128px] lg:w-[112px]',
    show: 'flex',
    spot: 'bottom-3 right-[30%] rotate-6',
  },
  {
    label: 'Waxing',
    Icon: Flower2,
    tone: 'bg-tint-b text-ink border-accent-300',
    size: 'h-[104px] w-[84px] md:h-[118px] md:w-[96px] lg:h-[130px] lg:w-[108px]',
    show: 'flex',
    spot: 'bottom-3 right-[14%] -rotate-6',
  },
  {
    label: 'Spa',
    Icon: Gem,
    tone: 'bg-cream text-ink border-accent-300',
    size: 'h-[110px] w-[90px] md:h-[122px] md:w-[98px] lg:h-[136px] lg:w-[110px]',
    show: 'hidden md:flex',
    spot: 'bottom-3 right-[2%] rotate-3',
  },
  {
    label: 'Nails',
    Icon: Hand,
    tone: 'bg-ivory text-ink border-accent-300',
    size: 'h-[104px] w-[86px] md:h-[116px] md:w-[96px] lg:h-[126px] lg:w-[106px]',
    show: 'hidden lg:flex',
    spot: 'bottom-24 left-[10%] rotate-2',
  },
  {
    label: 'Facial',
    Icon: Smile,
    tone: 'bg-tint-d text-ink border-accent-300',
    size: 'h-[104px] w-[88px] md:h-[116px] md:w-[98px] lg:h-[128px] lg:w-[110px]',
    show: 'hidden lg:flex',
    spot: 'bottom-24 right-[8%] -rotate-3',
  },
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

  const stageRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const physicsRef = React.useRef<{ respawn: () => void } | null>(null);
  const [mode, setMode] = React.useState<'static' | 'physics'>('static');

  // Phase 1: unless the visitor prefers reduced motion, fetch matter-js (only ever loaded here).
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    void import('matter-js')
      .then(() => {
        if (!cancelled) setMode('physics');
      })
      .catch(() => {
        // Could not load: the static layout simply stays.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Phase 2: the physics layout is rendered (cards measured at their real sizes) - start the simulation.
  React.useEffect(() => {
    const stage = stageRef.current;
    if (mode !== 'physics' || !stage) return;

    let destroy: (() => void) | null = null;
    let cancelled = false;

    void Promise.all([import('matter-js'), import('@/lib/cardPhysics')])
      .then(([matter, physics]) => {
        if (cancelled) return;
        const M = (matter as { default?: unknown }).default ?? matter;
        const cards = cardRefs.current.filter((el): el is HTMLDivElement => el !== null);
        const instance = physics.startCardPhysics(
          M as Parameters<typeof physics.startCardPhysics>[0],
          stage,
          cards,
        );
        physicsRef.current = instance;
        destroy = instance.destroy;
      })
      .catch(() => {
        if (!cancelled) setMode('static');
      });

    return () => {
      cancelled = true;
      physicsRef.current = null;
      destroy?.();
    };
  }, [mode]);

  const physics = mode === 'physics';

  return (
    <>
      <Head title="Page not found | Looks Smart Beauty Salon">
        {/* eslint-disable-next-line react/no-unknown-property */}
        <meta head-key="robots" name="robots" content="noindex,follow" />
      </Head>

      <section className="px-6 py-8 lg:px-10 lg:py-12">
        <div className="mx-auto max-w-5xl">
          {/* Stage: the cards live in this box; the text sits above them and lets pointers through. */}
          <div
            ref={stageRef}
            className="relative min-h-[max(70svh,560px)] overflow-hidden rounded-3xl"
          >
            <div className="absolute inset-0">
              {CARDS.map((card, index) => (
                <div
                  key={card.label}
                  ref={(el) => {
                    cardRefs.current[index] = el;
                  }}
                  aria-hidden="true"
                  className={`${card.show} ${card.size} ${card.tone} font-display absolute flex-col items-center justify-center gap-2 rounded-2xl border shadow-lg will-change-transform select-none ${
                    physics
                      ? 'top-0 left-0 cursor-grab touch-none opacity-0 transition-opacity duration-300'
                      : card.spot
                  }`}
                >
                  <card.Icon className="size-7" aria-hidden="true" />
                  <span className="text-base">{card.label}</span>
                </div>
              ))}
            </div>

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
                  onClick={() => physicsRef.current?.respawn()}
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
