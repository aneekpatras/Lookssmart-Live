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
  claim_label: string;
  claim_url: string | null;
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
 * The full-width promotional strip between the services and the offers. Every word comes from Admin >
 * Settings > Deals Bar; the countdown only shows while its end date is still in the future. "Claim"
 * goes to the booking page with that deal's services and promo code already applied.
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

        <div className="flex flex-col gap-4 lg:shrink-0 lg:flex-row lg:items-center">
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
          <div className="flex flex-wrap gap-3">
            {bar.claim_url && (
              <Button asChild variant="accent" size="lg">
                <Link href={bar.claim_url}>{bar.claim_label}</Link>
              </Button>
            )}
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-ivory/40 text-ivory hover:bg-ivory/10 bg-transparent"
            >
              <Link href={bar.url}>
                {bar.button_label} <ArrowRight aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </div>
      </div>
    </section>
  );
}

/** A deal's image, else the first attached service's photo, else null (the card draws a branded block). */
function dealImage(deal: MarqueeDeal): string | null {
  return deal.image_url ?? deal.bundled_services.find((s) => s.image_url)?.image_url ?? null;
}

/** "Valid till 30 Nov" (year added only when it is not this year), in the salon's own time zone. */
function validTill(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const end = new Date(endsAt);
  if (Number.isNaN(end.getTime()) || end.getTime() <= Date.now()) return null;
  const sameYear = end.getFullYear() === new Date().getFullYear();
  const text = new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'short',
    ...(sameYear ? {} : { year: 'numeric' }),
    timeZone: 'Asia/Karachi',
  }).format(end);
  return `Valid till ${text}`;
}

/**
 * One deal card, built like a service card (image, category, title, details). Compact on purpose: the
 * same two-up size as the service cards on phones and tablets, a little wider on desktop so three to
 * four are visible. Clicking anywhere opens the deal's own page (the title link stretches over the
 * card); the two buttons are pinned to the bottom so they line up whatever the text length.
 */
function DealMarqueeCard({ deal, duplicate }: { deal: MarqueeDeal; duplicate: boolean }) {
  const image = dealImage(deal);
  const percent = deal.savings_percent ?? (deal.type === 'percent' ? Number(deal.value) : null);
  const timing =
    validTill(deal.ends_at) ??
    (deal.included_services.length > 0
      ? `${deal.included_services.length} ${deal.included_services.length === 1 ? 'service' : 'services'} included`
      : null);
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
      className="w-[calc((100vw-3.75rem)/2)] shrink-0 sm:w-[calc((100vw-7.25rem)/2)] lg:w-[300px]"
      aria-hidden={duplicate ? 'true' : undefined}
    >
      <article className="border-border-soft bg-surface shadow-soft hover:border-accent-400 relative flex h-full flex-col overflow-hidden rounded-2xl border transition-colors">
        <div className="bg-accent-50 relative h-[110px] shrink-0 overflow-hidden sm:h-[170px] lg:h-[180px]">
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
              <Sparkles className="size-8" aria-hidden="true" />
            </div>
          )}
          {percent !== null && percent > 0 && (
            <span className="bg-accent-500 text-ivory absolute top-2 left-2 rounded-full px-2 py-0.5 text-[11px] font-semibold shadow-sm sm:top-3 sm:left-3 sm:px-2.5 sm:py-1 sm:text-xs">
              {percent}% OFF
            </span>
          )}
          {deal.is_top_deal && (
            <span className="bg-ink/85 text-accent-300 absolute top-2 right-2 hidden rounded-full px-2.5 py-1 text-[10px] font-semibold tracking-wider uppercase sm:top-3 sm:right-3 sm:block">
              Top deal
            </span>
          )}
        </div>

        <div className="flex flex-1 flex-col p-3 sm:p-4">
          <p className="text-accent-700 truncate text-[10px] font-semibold tracking-wider uppercase sm:text-xs">
            {deal.category_tag ?? 'Deal'}
          </p>
          <h3 className="mt-1 line-clamp-2 min-h-[2.5rem] text-sm leading-snug font-medium sm:min-h-[3rem] sm:text-base">
            <Link
              href={`/deals/${deal.slug}`}
              tabIndex={duplicate ? -1 : undefined}
              draggable={false}
              className="focus-visible:ring-accent-500 rounded after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:outline-none"
            >
              {deal.title}
            </Link>
          </h3>

          <p className="text-ink-muted mt-1 hidden min-h-[2.5rem] text-xs leading-5 sm:line-clamp-2 sm:block">
            {shown.join(' + ')}
            {more > 0 && <span className="text-accent-700 font-semibold"> +{more} more</span>}
          </p>

          <div className="mt-2 flex flex-col gap-0.5 sm:mt-1">
            {deal.deal_price && (
              <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="font-display text-base font-medium sm:text-lg">
                  {formatCurrency(deal.deal_price)}
                </span>
                {deal.original_price && (
                  <span className="text-ink-muted text-xs line-through">
                    {formatCurrency(deal.original_price)}
                  </span>
                )}
              </p>
            )}
            {timing && (
              <p className="text-ink-muted flex items-center gap-1 truncate text-[11px] sm:text-xs">
                <Clock3 className="size-3 shrink-0 sm:size-3.5" aria-hidden="true" />
                <span className="truncate">{timing}</span>
              </p>
            )}
          </div>

          {/* Pinned to the bottom of every card, so the two buttons sit on one line across the row. */}
          <div className="relative z-10 mt-auto grid grid-cols-2 gap-1.5 pt-3 sm:gap-2">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-8 px-1.5 text-[11px] sm:px-2 sm:text-xs"
              tabIndex={duplicate ? -1 : undefined}
              onClick={handleAddToCart}
            >
              <Plus className="hidden size-3.5 sm:block" aria-hidden="true" /> Add to Cart
            </Button>
            <Button
              asChild
              size="sm"
              variant="accent"
              className="h-8 px-1.5 text-[11px] sm:px-2 sm:text-xs"
            >
              <Link href={deal.claim_url} tabIndex={duplicate ? -1 : undefined} draggable={false}>
                Claim<span className="hidden sm:inline">&nbsp;Offer</span>
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
 * running against each other (the second left-to-right), each card the size of a service card.
 */
export function DealsMarquee({ deals }: { deals: MarqueeDeal[] }) {
  const desktop = useIsDesktop();
  const rowA = React.useMemo(() => deals.filter((_, index) => index % 2 === 0), [deals]);
  const rowB = React.useMemo(() => deals.filter((_, index) => index % 2 === 1), [deals]);

  if (desktop || deals.length < 2) {
    return <DealRow deals={deals} min={6} label="Current deals" />;
  }

  return (
    <div className="space-y-3 sm:space-y-5">
      <DealRow deals={rowA} min={6} label="Current deals, first row" />
      <DealRow deals={rowB} min={6} reverse label="Current deals, second row" />
    </div>
  );
}
