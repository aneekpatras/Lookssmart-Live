import { Link } from '@inertiajs/react';
import { ArrowRight, CalendarCheck, Check, Heart, Sparkles } from 'lucide-react';
import * as React from 'react';

import { Button } from '@/Components/ui/button';
import { dealTiming } from '@/lib/format';
import { formatCurrency } from '@/lib/currency';
import { cn } from '@/lib/utils';

export interface ShowcaseSlide {
  id: number | string;
  url: string;
  title: string;
  subtitle: string | null;
  link: string | null;
  focus: 'top' | 'center';
  /** 'contain' shows the whole image over a blurred copy of itself; missing means 'cover'. */
  fit?: 'cover' | 'contain';
}

export interface ShowcaseData {
  options: {
    eyebrow: string;
    heading_1: string;
    heading_2: string;
    paragraph: string;
    chips_label: string;
    deal_label: string;
    deal_button_label: string;
    deal_button_url: string;
    primary_label: string;
    primary_url: string;
    secondary_label: string;
    secondary_url: string;
    trust_1: string;
    trust_2: string;
    trust_3: string;
    card_title: string;
    card_line: string;
    interval: number;
  };
  chips: { id: number; name: string }[];
  slides: ShowcaseSlide[];
  deal: {
    title: string;
    deal_price: string | null;
    original_price: string | null;
    percent: number | null;
    ends_at: string | null;
    included_count: number;
  } | null;
}

/** Internal links use the Inertia Link; https:// links open as normal anchors. */
function SmartLink({
  href,
  className,
  children,
  tabIndex,
}: {
  href: string;
  className?: string;
  children: React.ReactNode;
  tabIndex?: number;
}) {
  return href.startsWith('/') ? (
    <Link href={href} className={className} tabIndex={tabIndex}>
      {children}
    </Link>
  ) : (
    <a href={href} className={className} tabIndex={tabIndex} rel="noopener noreferrer">
      {children}
    </a>
  );
}

/**
 * The mirror-arch image slider: stacked images with an opacity crossfade, autoplay (paused on hover, focus
 * and while the tab is hidden), dots, touch swipe, and no motion at all under prefers-reduced-motion.
 */
function ArchSlider({
  slides,
  interval,
  cardTitle,
  cardLine,
}: {
  slides: ShowcaseSlide[];
  interval: number;
  cardTitle: string;
  cardLine: string;
}) {
  const [index, setIndex] = React.useState(0);
  const [shown, setShown] = React.useState(0);
  const [hovered, setHovered] = React.useState(false);
  const [focused, setFocused] = React.useState(false);
  const [hidden, setHidden] = React.useState(false);
  const [reduced, setReduced] = React.useState(false);
  const touchX = React.useRef<number | null>(null);
  const count = slides.length;

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setReduced(query.matches);
    apply();
    query.addEventListener('change', apply);
    const onVisibility = () => setHidden(document.visibilityState === 'hidden');
    onVisibility();
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      query.removeEventListener('change', apply);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  React.useEffect(() => {
    if (count < 2 || reduced || hovered || focused || hidden) return;
    const timer = window.setInterval(() => setIndex((i) => (i + 1) % count), interval * 1000);
    return () => window.clearInterval(timer);
  }, [count, reduced, hovered, focused, hidden, interval]);

  // The caption card follows the slide through a short fade (immediate under reduced motion).
  React.useEffect(() => {
    if (index === shown || reduced) return;
    const timer = window.setTimeout(() => setShown(index), 200);
    return () => window.clearTimeout(timer);
  }, [index, shown, reduced]);
  const fading = !reduced && index !== shown;

  const current = slides[reduced ? index : shown] ?? slides[0];
  const hasCaption = !!current && current.title !== '';
  const caption = current && hasCaption && (
    <>
      <span className="font-display block text-sm leading-tight font-medium">{current.title}</span>
      {current.subtitle && (
        <span className="text-ink/80 mt-0.5 block text-[11px] leading-snug">
          {current.subtitle}
        </span>
      )}
    </>
  );

  function onTouchEnd(event: React.TouchEvent) {
    const start = touchX.current;
    touchX.current = null;
    if (start === null || count < 2) return;
    const delta = (event.changedTouches[0]?.clientX ?? start) - start;
    if (Math.abs(delta) > 40) setIndex((i) => (i + (delta < 0 ? 1 : -1) + count) % count);
  }

  return (
    <div
      className="relative mx-auto w-[min(85vw,380px)] md:w-[380px] lg:w-[440px]"
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      onFocus={() => setFocused(true)}
      onBlur={() => setFocused(false)}
      onTouchStart={(event) => {
        touchX.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={onTouchEnd}
      role="group"
      aria-roledescription="carousel"
      aria-label="Bridal looks"
    >
      <div className="border-accent-500 bg-surface relative aspect-[3/4] overflow-hidden rounded-t-full rounded-b-xl border-[1.5px]">
        {slides.map((slide, i) => (
          <div
            key={slide.id}
            aria-hidden={i === index ? undefined : 'true'}
            className={cn(
              'absolute inset-0 transition-opacity duration-[600ms] motion-reduce:transition-none',
              i === index ? 'opacity-100' : 'opacity-0',
            )}
          >
            {slide.fit === 'contain' && (
              <img
                src={slide.url}
                alt=""
                aria-hidden="true"
                loading={i === 0 ? 'eager' : 'lazy'}
                decoding="async"
                className="absolute inset-0 size-full scale-110 object-cover opacity-60 blur-2xl"
              />
            )}
            <img
              src={slide.url}
              alt={slide.title}
              width={900}
              height={1200}
              loading={i === 0 ? 'eager' : 'lazy'}
              decoding="async"
              className={cn(
                'absolute inset-0 size-full',
                slide.fit === 'contain'
                  ? 'object-contain object-center'
                  : slide.focus === 'center'
                    ? 'object-cover object-center'
                    : 'object-cover object-top',
              )}
            />
          </div>
        ))}
        <div
          aria-hidden="true"
          className="border-accent-500/40 pointer-events-none absolute inset-[7px] rounded-t-full rounded-b-lg border"
        />
      </div>
      {count > 1 && (
        <div className="mt-2 flex justify-center gap-0.5">
          {slides.map((slide, i) => (
            <button
              key={slide.id}
              type="button"
              aria-label={`Show image ${i + 1}`}
              aria-current={i === index ? 'true' : undefined}
              onClick={() => setIndex(i)}
              className="focus-visible:ring-accent-500 flex size-6 items-center justify-center rounded-full focus-visible:ring-2 focus-visible:outline-none"
            >
              <span
                className={cn(
                  'block h-2 rounded-full transition-all motion-reduce:transition-none',
                  i === index ? 'bg-accent-500 w-5' : 'bg-accent-500/40 w-2',
                )}
              />
            </button>
          ))}
        </div>
      )}

      {/* Caption of the current slide (bottom-left) and a static note (top-right). Both stay inside the
          arch's own column, so nothing overflows at 320px. */}
      {hasCaption && current && (
        <div
          className={cn(
            'bg-surface/95 border-border-soft shadow-soft absolute bottom-10 left-1 z-10 max-w-[62%] rounded-xl border px-3 py-2 transition-opacity duration-200 motion-reduce:transition-none',
            fading ? 'opacity-0' : 'opacity-100',
          )}
        >
          {current.link ? (
            <SmartLink href={current.link} className="flex items-start gap-1.5 hover:underline">
              <span className="min-w-0">{caption}</span>
              <ArrowRight className="text-accent-700 mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
            </SmartLink>
          ) : (
            caption
          )}
        </div>
      )}
      <div className="bg-surface/95 border-border-soft shadow-soft absolute top-14 right-1 z-10 max-w-[44%] rounded-xl border px-3 py-2 text-right">
        <span className="font-display text-accent-700 block text-base leading-tight font-medium">
          {cardTitle}
        </span>
        <span className="text-ink/80 block text-[11px] leading-snug">{cardLine}</span>
      </div>
    </div>
  );
}

export function HomeShowcase({ showcase }: { showcase: ShowcaseData }) {
  const { options, chips, slides, deal } = showcase;
  const trust = [options.trust_1, options.trust_2, options.trust_3].filter((text) => text !== '');
  const timing = deal ? dealTiming(deal.ends_at, deal.included_count) : null;
  const hasImage = slides.length > 0;

  return (
    <section className="bg-ivory px-6 py-14 sm:py-20 lg:px-10 lg:py-24">
      <div
        className={cn(
          'mx-auto grid max-w-6xl items-center gap-12',
          hasImage ? 'lg:grid-cols-2 lg:gap-16' : 'max-w-3xl',
        )}
      >
        <div className="min-w-0">
          <p className="border-accent-500/40 bg-accent-500/10 text-accent-700 inline-flex items-center gap-2 rounded-full border px-3.5 py-1.5 text-xs font-semibold">
            <Heart className="size-3.5" aria-hidden="true" />
            {options.eyebrow}
          </p>
          <h2 className="font-display mt-5 text-4xl leading-[1.08] font-medium text-balance sm:text-5xl lg:text-6xl">
            <span className="block">{options.heading_1}</span>
            <span className="text-accent-600 block italic">{options.heading_2}</span>
          </h2>
          <p className="text-ink/80 mt-5 max-w-xl text-base leading-7 font-medium sm:text-lg">
            {options.paragraph}
          </p>

          {chips.length > 0 && (
            <div className="mt-7 min-w-0">
              <p className="text-ink/80 text-xs font-semibold tracking-wider uppercase">
                {options.chips_label}
              </p>
              <ul className="-mx-6 mt-3 flex [scrollbar-width:none] gap-2 overflow-x-auto px-6 pb-1 whitespace-nowrap sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0 [&::-webkit-scrollbar]:hidden">
                {chips.map((chip) => (
                  <li key={chip.id} className="shrink-0">
                    <Link
                      href={`/services#services-category-${chip.id}`}
                      className="border-border-soft bg-surface hover:border-accent-500 hover:text-accent-700 focus-visible:ring-accent-500 inline-block rounded-full border px-3.5 py-1.5 text-sm font-medium transition-colors focus-visible:ring-2 focus-visible:outline-none"
                    >
                      {chip.name}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {deal && (
            <div className="border-border-soft bg-surface shadow-soft mt-7 flex flex-wrap items-center justify-between gap-4 rounded-2xl border p-4">
              <div className="min-w-0">
                <p className="text-accent-700 text-[11px] font-semibold tracking-wider uppercase">
                  {options.deal_label}
                </p>
                <p className="mt-0.5 truncate font-semibold">{deal.title}</p>
                <p className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
                  {deal.deal_price && (
                    <span className="font-display text-lg font-medium">
                      {formatCurrency(deal.deal_price)}
                    </span>
                  )}
                  {deal.original_price && (
                    <span className="text-ink/80 text-xs line-through">
                      {formatCurrency(deal.original_price)}
                    </span>
                  )}
                  {deal.percent !== null && deal.percent > 0 && (
                    <span className="bg-accent-500 text-ivory rounded-full px-2 py-0.5 text-[11px] font-semibold">
                      {deal.percent}% OFF
                    </span>
                  )}
                </p>
                {timing && <p className="text-ink/80 mt-1 text-xs">{timing}</p>}
              </div>
              <Button asChild size="sm" variant="outline">
                <SmartLink href={options.deal_button_url}>{options.deal_button_label}</SmartLink>
              </Button>
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3">
            <Button asChild size="lg" variant="accent">
              <SmartLink href={options.primary_url}>
                <CalendarCheck aria-hidden="true" /> {options.primary_label}
              </SmartLink>
            </Button>
            <Button asChild size="lg" variant="outline">
              <SmartLink href={options.secondary_url}>
                <Sparkles aria-hidden="true" /> {options.secondary_label}
              </SmartLink>
            </Button>
          </div>

          {trust.length > 0 && (
            <ul className="text-ink/80 mt-7 flex flex-wrap gap-x-6 gap-y-2 text-sm font-medium">
              {trust.map((text) => (
                <li key={text} className="flex items-center gap-2">
                  <Check className="text-accent-600 size-4" aria-hidden="true" />
                  {text}
                </li>
              ))}
            </ul>
          )}
        </div>

        {hasImage && (
          <ArchSlider
            slides={slides}
            interval={options.interval}
            cardTitle={options.card_title}
            cardLine={options.card_line}
          />
        )}
      </div>
    </section>
  );
}
