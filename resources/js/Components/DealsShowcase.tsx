import { Link } from '@inertiajs/react';
import { ArrowRight, Clock3, Plus, Sparkles } from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { AutoMarquee } from '@/Components/AutoMarquee';
import type { DealShowcase } from '@/Components/DealDetailsModal';
import { Button } from '@/Components/ui/button';
import { addToCart } from '@/lib/cart';
import { formatCurrency } from '@/lib/currency';

export interface MarqueeDeal extends DealShowcase {
  type?: string;
  value?: string;
  code?: string | null;
}

export interface DealsBarData {
  badge: string;
  headline: string;
  subtext: string | null;
  ends_at: string | null;
  button_label: string;
  url: string;
}

/** Days / hours / minutes / seconds left until `endsAt`, or null once it has passed. */
function useCountdown(endsAt: string | null) {
  const target = React.useMemo(() => (endsAt ? new Date(endsAt).getTime() : null), [endsAt]);
  const [now, setNow] = React.useState(() => Date.now());

  React.useEffect(() => {
    if (target === null) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [target]);

  if (target === null || target <= now) return null;

  const total = Math.floor((target - now) / 1000);

  return {
    days: Math.floor(total / 86400),
    hours: Math.floor((total % 86400) / 3600),
    minutes: Math.floor((total % 3600) / 60),
    seconds: total % 60,
  };
}

/**
 * The full-width strip at the top of the homepage deals section. Every word comes from Admin >
 * Settings > Deals Bar; the countdown only shows while its end date is still in the future.
 */
export function DealsBar({ bar }: { bar: DealsBarData }) {
  const left = useCountdown(bar.ends_at);
  const units = left
    ? [
        { label: 'Days', value: left.days },
        { label: 'Hours', value: left.hours },
        { label: 'Mins', value: left.minutes },
        { label: 'Secs', value: left.seconds },
      ]
    : [];

  return (
    <section
      aria-label="Limited-time offer"
      className="bg-ink text-ivory relative isolate overflow-hidden"
    >
      <div
        className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_88%_0%,rgba(201,166,107,0.30),transparent_55%),radial-gradient(circle_at_0%_100%,rgba(201,166,107,0.12),transparent_45%)]"
        aria-hidden="true"
      />
      <div className="mx-auto flex max-w-6xl flex-col gap-6 px-6 py-8 lg:flex-row lg:items-center lg:justify-between lg:gap-10 lg:px-10">
        <div className="min-w-0 lg:max-w-xl">
          <p className="border-accent-500/40 bg-accent-500/15 text-accent-300 inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold tracking-[0.18em] uppercase">
            <Sparkles className="size-3.5" aria-hidden="true" /> {bar.badge}
          </p>
          <h2 className="font-display mt-3 text-2xl leading-tight font-medium text-balance sm:text-3xl lg:text-4xl">
            {bar.headline}
          </h2>
          {bar.subtext && <p className="text-ivory/70 mt-2 text-sm leading-6">{bar.subtext}</p>}
        </div>

        <div className="flex flex-col gap-4 sm:flex-row sm:items-center lg:shrink-0">
          {units.length > 0 && (
            <div
              role="timer"
              aria-label="Time left on this offer"
              className="flex items-center gap-2"
            >
              {units.map((unit, index) => (
                <React.Fragment key={unit.label}>
                  {index > 0 && (
                    <span className="text-accent-300 -mt-3 font-semibold" aria-hidden="true">
                      :
                    </span>
                  )}
                  <div className="border-ivory/15 bg-ivory/5 w-14 rounded-xl border py-2 text-center sm:w-16">
                    <div className="font-display text-xl font-semibold tabular-nums sm:text-2xl">
                      {String(unit.value).padStart(2, '0')}
                    </div>
                    <div className="text-accent-300 text-[10px] font-semibold tracking-wider uppercase">
                      {unit.label}
                    </div>
                  </div>
                </React.Fragment>
              ))}
            </div>
          )}
          <Button asChild variant="accent" size="lg">
            <Link href={bar.url}>
              {bar.button_label} <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}

/** A deal's image, else the first attached service's photo, else null (the card draws a branded block). */
function dealImage(deal: MarqueeDeal): string | null {
  return (
    deal.image_url ?? deal.bundled_services.find((service) => service.image_url)?.image_url ?? null
  );
}

function daysLeft(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - Date.now();
  if (Number.isNaN(ms) || ms <= 0) return null;
  const days = Math.ceil(ms / 86_400_000);
  return days === 1 ? 'Ends today or tomorrow' : `${days} days left`;
}

/**
 * One deal card, built like a service card (image, category, title, details) at the gallery card's
 * size. Clicking anywhere opens the deal's own page (the title link stretches over the card); the
 * two buttons sit above that layer.
 */
function DealMarqueeCard({ deal, duplicate }: { deal: MarqueeDeal; duplicate: boolean }) {
  const image = dealImage(deal);
  const percent = deal.savings_percent ?? (deal.type === 'percent' ? Number(deal.value) : null);
  const left = daysLeft(deal.ends_at);
  const shown = deal.included_services.slice(0, 2);
  const more = deal.included_services.length - shown.length;

  function handleAddToCart() {
    addToCart(
      {
        kind: 'deal',
        dealId: deal.id,
        label: deal.title,
        bundledServices: deal.bundled_services,
        originalPrice: deal.original_price,
        dealPrice: deal.deal_price,
      },
      toast,
    );
  }

  return (
    <li
      className="w-[62vw] max-w-[240px] shrink-0 sm:w-[264px] sm:max-w-none"
      aria-hidden={duplicate ? 'true' : undefined}
    >
      <article className="border-border-soft bg-surface shadow-soft hover:border-accent-400 relative flex h-full flex-col overflow-hidden rounded-2xl border transition-colors">
        <div className="bg-accent-50 relative aspect-[3/4] overflow-hidden">
          {image ? (
            <img
              src={image}
              alt=""
              loading="lazy"
              decoding="async"
              draggable={false}
              className="size-full object-cover"
            />
          ) : (
            <div className="bg-ink text-accent-300 flex size-full items-center justify-center">
              <Sparkles className="size-10" aria-hidden="true" />
            </div>
          )}
          {percent !== null && percent > 0 && (
            <span className="bg-accent-500 text-ivory absolute top-3 left-3 rounded-full px-2.5 py-1 text-xs font-semibold shadow-sm">
              {percent}% OFF
            </span>
          )}
          {deal.is_top_deal && (
            <span className="bg-ink/85 text-accent-300 absolute top-3 right-3 rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase">
              Top deal
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-4">
          {deal.category_tag && (
            <p className="text-accent-700 text-[11px] font-semibold tracking-[0.16em] uppercase">
              {deal.category_tag}
            </p>
          )}
          <h3 className="font-display mt-1 text-lg leading-snug font-medium">
            <Link
              href={`/deals/${deal.slug}`}
              tabIndex={duplicate ? -1 : undefined}
              draggable={false}
              className="focus-visible:ring-accent-500 rounded after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:outline-none"
            >
              {deal.title}
            </Link>
          </h3>

          {shown.length > 0 && (
            <p className="text-ink-muted mt-2 line-clamp-2 text-xs leading-5">
              {shown.join(' + ')}
              {more > 0 && <span className="text-accent-700 font-semibold"> +{more} more</span>}
            </p>
          )}

          <div className="mt-3 flex items-end justify-between gap-2">
            {deal.deal_price ? (
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-xl font-medium">
                  {formatCurrency(deal.deal_price)}
                </span>
                {deal.original_price && (
                  <span className="text-ink-muted text-xs line-through">
                    {formatCurrency(deal.original_price)}
                  </span>
                )}
              </p>
            ) : (
              <span />
            )}
            {left && (
              <span className="text-ink-muted flex shrink-0 items-center gap-1 text-xs">
                <Clock3 className="size-3.5" aria-hidden="true" /> {left}
              </span>
            )}
          </div>

          <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="px-2 text-xs"
              tabIndex={duplicate ? -1 : undefined}
              onClick={handleAddToCart}
            >
              <Plus className="hidden size-4 sm:block" aria-hidden="true" /> Add to Cart
            </Button>
            <Button asChild size="sm" variant="accent" className="px-2 text-xs">
              <Link href={deal.claim_url} tabIndex={duplicate ? -1 : undefined} draggable={false}>
                Claim Offer
              </Link>
            </Button>
          </div>
        </div>
      </article>
    </li>
  );
}

/** Repeats a short list until it is at least `min` long, so one pass of the loop is wider than the screen. */
function fill<T>(list: T[], min: number): T[] {
  if (list.length === 0) return list;
  const out = [...list];
  while (out.length < min) out.push(list[out.length % list.length] as T);
  return out;
}

function useIsDesktop(): boolean {
  const [desktop, setDesktop] = React.useState(() =>
    typeof window === 'undefined' ? true : window.matchMedia('(min-width: 1024px)').matches,
  );

  React.useEffect(() => {
    const query = window.matchMedia('(min-width: 1024px)');
    const apply = () => setDesktop(query.matches);
    apply();
    query.addEventListener('change', apply);
    return () => query.removeEventListener('change', apply);
  }, []);

  return desktop;
}

function DealRow({
  deals,
  reverse,
  min,
  label,
}: {
  deals: MarqueeDeal[];
  reverse?: boolean;
  min: number;
  label: string;
}) {
  const list = React.useMemo(() => fill(deals, min), [deals, min]);

  return (
    <AutoMarquee
      count={list.length}
      reverse={reverse}
      secondsPerCard={4}
      label={label}
      renderItem={(index, duplicate) => {
        const deal = list[index];
        return deal ? (
          <DealMarqueeCard deal={deal} duplicate={duplicate || index >= deals.length} />
        ) : null;
      }}
    />
  );
}

/**
 * Deals auto-scroll right-to-left like the gallery. On phones and tablets they become two rows
 * running against each other (the second left-to-right).
 */
export function DealsMarquee({ deals }: { deals: MarqueeDeal[] }) {
  const desktop = useIsDesktop();
  const rowA = React.useMemo(() => deals.filter((_, index) => index % 2 === 0), [deals]);
  const rowB = React.useMemo(() => deals.filter((_, index) => index % 2 === 1), [deals]);

  if (desktop || deals.length < 2) {
    return <DealRow deals={deals} min={6} label="Current deals" />;
  }

  return (
    <div className="space-y-4 sm:space-y-5">
      <DealRow deals={rowA} min={4} label="Current deals, first row" />
      <DealRow deals={rowB} min={4} reverse label="Current deals, second row" />
    </div>
  );
}
