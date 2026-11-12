import { Link, usePage } from '@inertiajs/react';
import {
  ArrowRight,
  Award,
  Camera,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
  Phone,
  Plus,
  ShieldCheck,
  Sparkles,
  Star,
  Users,
  ExternalLink,
} from 'lucide-react';
import * as React from 'react';
import { toast } from 'sonner';

import { BridalMarquee, type MarqueeImage } from '@/Components/BridalMarquee';
import { ReviewsCarousel, type ReviewShowcase } from '@/Components/ReviewsCarousel';
import { SeoHead } from '@/Components/SeoHead';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import type { DealShowcase } from '@/Components/DealDetailsModal';
import { DealsBar, DealsMarquee, type DealsBarData } from '@/Components/DealsShowcase';
import { WriteReviewModal } from '@/Components/WriteReviewModal';
import PublicLayout from '@/Layouts/PublicLayout';
import { addToCart } from '@/lib/cart';
import { formatCurrency } from '@/lib/currency';

interface ServiceCard {
  id: number;
  name: string;
  slug: string;
  category: string | null;
  duration_min: number;
  price: string;
  image_url: string | null;
  rating: number | null;
  review_count: number;
}

/** A homepage offer is a full deal showcase payload (so Details can open) plus the card's own extras. */
interface Offer extends DealShowcase {
  type: string;
  value: string;
  code: string | null;
}

interface LegacyStat {
  icon: string;
  value: string;
  label: string;
  detail: string;
}

interface WhatsAppSupport {
  display_phone: string;
  chat_url: string;
  qr_data_uri: string;
}

interface OpeningHour {
  weekday: number; // 0 = Sunday … 6 = Saturday
  open_time: string | null;
  close_time: string | null;
  is_closed: boolean;
}

/** True when `now` (read in Asia/Karachi, whatever the visitor's own time zone) falls inside that day's hours. */
function isOpenNow(rows: OpeningHour[], now: Date): boolean | null {
  if (rows.length === 0) return null;
  const parts = new Intl.DateTimeFormat('en-US', {
    timeZone: 'Asia/Karachi',
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string) => parts.find((part) => part.type === type)?.value ?? '';
  const weekday = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].indexOf(get('weekday'));
  const minutes = Number(get('hour')) * 60 + Number(get('minute'));
  const toMinutes = (time: string) => {
    const [h, m] = time.split(':');
    return Number(h) * 60 + Number(m);
  };

  const today = rows.find((row) => row.weekday === weekday);
  if (!today || today.is_closed || !today.open_time || !today.close_time) return false;
  const open = toMinutes(today.open_time);
  const close = toMinutes(today.close_time);

  return close > open ? minutes >= open && minutes < close : minutes >= open || minutes < close;
}

/** Owner-confirmed hours (every day, 10:00 AM – 9:00 PM), used only when the business_hours table has no rows. */
const DEFAULT_HOURS_LABEL = { days: 'Monday – Sunday', hours: '10:00 AM – 9:00 PM' };
const DEFAULT_OPENING_HOURS: OpeningHour[] = [0, 1, 2, 3, 4, 5, 6].map((weekday) => ({
  weekday,
  open_time: '10:00:00',
  close_time: '21:00:00',
  is_closed: false,
}));

interface HomeProps {
  findUs: { address: string; directions: string; mapsUrl: string };
  featuredServices: ServiceCard[];
  categories: { id: number; name: string }[];
  featured_gallery_images: MarqueeImage[];
  legacyStats: LegacyStat[];
  openingHours: OpeningHour[];
  whatsapp: WhatsAppSupport;
  testimonials: ReviewShowcase[];
  offers: Offer[];
  dealsBar: DealsBarData | null;
  jsonLdSchema: Record<string, unknown>;
}

/**
 * Icon names are sent as strings from the controller (editorial content belongs there) and mapped
 * to components here — a component cannot be serialised through an Inertia prop. Unknown names fall
 * back to `Sparkles` rather than crashing the section.
 */
const LEGACY_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  award: Award,
  users: Users,
  star: Star,
  camera: Camera,
  shield: ShieldCheck,
  heart: Heart,
};

/** The globally shared `site` block — see HandleInertiaRequests::share(). */
interface SharedProps {
  [key: string]: unknown;
  site: {
    address: string | null;
    phone: string | null;
    hours: { days: string; hours: string }[];
  };
}

// `encodeURI` rather than a hand-typed %20 string: the asset's real filename genuinely contains
// spaces, and doing the encoding here keeps the readable name visible at the call site instead of
// hiding it behind escapes. It leaves the `/` separators alone, which encodeURIComponent would not.
const HERO_VIDEO = encodeURI('/images/looks smart beauty Salon in Lahore.mp4');

// Real photo of the salon, shown from the first paint and left in place permanently if the video
// cannot play at all (unsupported codec, blocked autoplay, a failed request, reduced motion). Desktop
// is 1600x900, mobile 900x1200; WebP first with a JPG fallback. The breakpoint (768px) must match the
// <link rel="preload"> media queries in resources/views/app.blade.php.
const HERO_POSTER = '/images/hero-poster.jpg';
const HERO_POSTER_ALT = 'Inside Looks Smart Beauty Salon, Central Park Housing Scheme, Lahore';

/** Reads better than "180 min" once past an hour; mirrors Services/ServiceDetail. */
function formatDuration(minutes: number): string {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

/**
 * Muted, looping background video with a genuinely working fallback chain: still poster → video,
 * degrading back to the poster if the video cannot play or the viewer asks for reduced motion.
 *
 * Deliberately renders the poster image on the server and mounts the `<video>` only on the client,
 * for three reasons that each caused a real problem:
 *
 * 1. **`prefers-reduced-motion` cannot be known during SSR.** A perpetually looping background
 *    video is exactly what that setting exists to suppress, so the decision has to be made in the
 *    browser. This uses `matchMedia` with a change listener rather than framer-motion's
 *    `useReducedMotion()`, which does `useState(ref.current)` — a ONE-SHOT read that its own source
 *    comments admit never updates. Under SSR that ref is `null`, so the hook locks in a falsy value
 *    and never corrects after hydration; it kept rendering the video for reduced-motion users, which
 *    a browser test caught. That hook is fine for animation config, not for branching what renders.
 * 2. **React does not serialise `muted` into server-rendered HTML** (it applies it as a DOM property
 *    on hydration), and this app runs Inertia SSR. Chrome judges autoplay against the markup it
 *    first parses, so a server-rendered `<video autoplay>` without `muted` gets blocked. Mounting
 *    client-side and setting `muted` imperatively before `play()` sidesteps that entirely.
 * 3. **Autoplay can still be refused** (data saver, battery saver, platform policy). `play()` returns
 *    a promise that rejects in that case and must be caught, or it surfaces as an unhandled
 *    rejection — and leaving the poster on screen is the correct outcome anyway.
 *
 * The upside of poster-first is that the hero paints immediately from a cached image rather than
 * waiting on video metadata, so the video never sits on the critical path.
 */
function HeroBackground() {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const posterRef = React.useRef<HTMLImageElement>(null);
  const [allowVideo, setAllowVideo] = React.useState(false);
  const [posterReady, setPosterReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setAllowVideo(!query.matches);

    apply();
    query.addEventListener('change', apply);

    return () => query.removeEventListener('change', apply);
  }, []);

  // The video is only requested once the poster has loaded and had a frame to paint in, so it can
  // never compete with the poster for bandwidth or delay it. A poster that fails to load must not
  // block the video forever, hence the error branch.
  React.useEffect(() => {
    const poster = posterRef.current;
    if (!poster) return;

    let frame = 0;
    const ready = () => {
      frame = requestAnimationFrame(() => setPosterReady(true));
    };

    if (poster.complete) {
      ready();
    } else {
      poster.addEventListener('load', ready, { once: true });
      poster.addEventListener('error', ready, { once: true });
    }

    return () => {
      cancelAnimationFrame(frame);
      poster.removeEventListener('load', ready);
      poster.removeEventListener('error', ready);
    };
  }, []);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !allowVideo || !posterReady) return;

    video.muted = true; // See (2) — required before play() for autoplay to be permitted.
    void video.play().catch(() => {
      // See (3): autoplay refused. The poster frame stays visible, so nothing more is needed.
    });
  }, [allowVideo, posterReady]);

  // The poster is always rendered, as the base layer: it paints first (high priority, never lazy,
  // fixed size so nothing shifts) and the video, when allowed, plays on top of it. Keeping one
  // permanent <img> also means the swap to video never flashes, and the photo keeps its alt text.
  return (
    <>
      <picture>
        <source
          media="(max-width: 767px)"
          srcSet="/images/hero-poster-mobile.webp"
          type="image/webp"
        />
        <source
          media="(max-width: 767px)"
          srcSet="/images/hero-poster-mobile.jpg"
          type="image/jpeg"
        />
        <source srcSet="/images/hero-poster.webp" type="image/webp" />
        <img
          ref={posterRef}
          data-hero-poster
          src={HERO_POSTER}
          alt={HERO_POSTER_ALT}
          width={1600}
          height={900}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      </picture>
      {allowVideo && posterReady && !failed && (
        <video
          ref={videoRef}
          className="absolute inset-0 -z-20 size-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          preload="metadata"
          aria-hidden="true"
          tabIndex={-1}
          onError={() => setFailed(true)}
        >
          <source src={HERO_VIDEO} type="video/mp4" />
        </video>
      )}
    </>
  );
}

/** The salon's Google Business profile — "See more reviews on Google" opens it in a new tab. */
const GOOGLE_REVIEWS_URL = 'https://share.google/TFzPVGK9Km33WBazJ';

export default function Home({
  featuredServices,
  categories,
  featured_gallery_images: featuredGalleryImages,
  legacyStats,
  whatsapp,
  offers,
  testimonials,
  jsonLdSchema,
  findUs,
  openingHours,
  dealsBar,
}: HomeProps) {
  const { site } = usePage<SharedProps>().props;
  // Computed after mount (and refreshed each minute) so it reflects the real clock, not the server's.
  const [openNow, setOpenNow] = React.useState<boolean | null>(null);
  React.useEffect(() => {
    const update = () =>
      setOpenNow(
        isOpenNow(openingHours.length > 0 ? openingHours : DEFAULT_OPENING_HOURS, new Date()),
      );
    update();
    const timer = window.setInterval(update, 60_000);
    return () => window.clearInterval(timer);
  }, [openingHours]);
  const phoneDisplay = site.phone ?? whatsapp.display_phone;
  const phoneDigits = phoneDisplay.replace(/[^\d+]/g, '');
  const [activeCategory, setActiveCategory] = React.useState<string>('all');
  const [writeReviewOpen, setWriteReviewOpen] = React.useState(false);
  // Seeded from the server prop; a newly submitted review is prepended so it shows at once
  // (the server also puts it first, so a reload agrees).
  const [liveTestimonials, setLiveTestimonials] = React.useState<ReviewShowcase[]>(testimonials);

  const visibleServices = (
    activeCategory === 'all'
      ? featuredServices
      : featuredServices.filter((service) => service.category === activeCategory)
  ).slice(0, 8);

  return (
    <>
      <SeoHead
        title="Thoughtful beauty, beautifully done"
        description="Hair, skin, and nail care in a calm, considered salon space."
        jsonLd={jsonLdSchema}
      />
      {/* Hero — muted looping background video behind a warm dark scrim */}
      <section className="text-ivory relative isolate flex min-h-[88svh] items-center overflow-hidden px-6 py-24 lg:px-10">
        <HeroBackground />
        {/* Two stacked layers: a warm champagne wash for brand tone, then a dark vertical gradient
            that guarantees text contrast regardless of what the video frame underneath is doing. */}
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_22%,rgba(201,166,107,0.28),transparent_45%),linear-gradient(180deg,rgba(23,19,17,0.72)_0%,rgba(23,19,17,0.58)_45%,rgba(23,19,17,0.86)_100%)]"
          aria-hidden="true"
        />
        <div className="mx-auto w-full max-w-6xl text-center">
          <p className="text-accent-300 mb-6 flex items-center justify-center gap-2 text-xs font-semibold tracking-[0.22em] uppercase">
            <Sparkles className="size-4" aria-hidden="true" /> Est. 2014 · Lahore
          </p>
          <h1 className="font-display mx-auto max-w-3xl text-4xl leading-[1.05] font-medium sm:text-6xl lg:text-7xl">
            Looks Smart Beauty Salon
          </h1>
          <p className="text-ivory/80 mx-auto mt-7 max-w-xl text-lg leading-8">
            A modern sanctuary for premium skin, hair, and bridal artistry in Lahore.
          </p>
          <div className="mt-10 flex flex-wrap justify-center gap-3">
            <Button asChild size="lg" variant="accent">
              <Link href="/book">
                Book Appointment <ArrowRight />
              </Link>
            </Button>
            <Button
              asChild
              size="lg"
              variant="outline"
              className="border-ivory/40 text-ivory hover:bg-ivory/10 bg-transparent"
            >
              <Link href="/services">View Services</Link>
            </Button>
          </div>
        </div>
      </section>

      {/* Our Specialized Services — category-filterable, 4 across on desktop */}
      <section className="px-6 py-14 sm:py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <h2 className="font-display text-3xl font-medium sm:text-5xl">
              Our Specialized Services
            </h2>
            <p className="text-ink-muted mx-auto mt-3 max-w-xl text-base sm:mt-4 sm:text-lg">
              Experience premium skin, hair, and beauty treatments in Lahore.
            </p>
          </div>

          {/* Pills are driven by the real categories the controller passes, never a hardcoded list,
              so they cannot drift out of sync with the catalog the way a literal array would. */}
          <div
            className="mt-7 flex [scrollbar-width:none] gap-2 overflow-x-auto pb-1 whitespace-nowrap sm:mt-9 sm:flex-wrap sm:justify-center sm:overflow-visible [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Filter services by category"
          >
            <button
              type="button"
              aria-pressed={activeCategory === 'all'}
              onClick={() => setActiveCategory('all')}
              className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                activeCategory === 'all'
                  ? 'border-accent-600 bg-accent-600 text-ivory'
                  : 'border-border-soft text-ink-muted hover:border-accent-500'
              }`}
            >
              All
            </button>
            {categories.map((category) => (
              <button
                key={category.id}
                type="button"
                aria-pressed={activeCategory === category.name}
                onClick={() => setActiveCategory(category.name)}
                className={`shrink-0 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors sm:px-4 sm:py-2 sm:text-sm ${
                  activeCategory === category.name
                    ? 'border-accent-600 bg-accent-600 text-ivory'
                    : 'border-border-soft text-ink-muted hover:border-accent-500'
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          <div className="mt-8 grid grid-cols-2 gap-3 sm:mt-10 sm:gap-4 lg:grid-cols-4">
            {visibleServices.map((service) => (
              <Card
                key={service.id}
                className="border-border-soft bg-surface shadow-soft flex flex-col overflow-hidden"
              >
                <Link
                  href={`/services/${service.slug}`}
                  aria-label={`View ${service.name}`}
                  className="bg-accent-50 block h-[110px] shrink-0 sm:h-[170px]"
                >
                  {service.image_url ? (
                    <img
                      src={service.image_url}
                      alt={service.name}
                      className="size-full object-cover"
                      loading="lazy"
                      decoding="async"
                    />
                  ) : (
                    <div className="text-accent-700 flex size-full items-center justify-center">
                      <Sparkles className="size-8" aria-hidden="true" />
                    </div>
                  )}
                </Link>
                <CardContent className="flex flex-1 flex-col p-3 sm:p-4">
                  <p className="text-accent-700 hidden text-xs font-semibold tracking-wider uppercase sm:block">
                    {service.category}
                  </p>
                  <h3 className="line-clamp-2 text-sm leading-snug font-medium sm:mt-1.5 sm:line-clamp-none sm:text-base">
                    <Link href={`/services/${service.slug}`}>{service.name}</Link>
                  </h3>
                  <div className="text-ink-muted mt-auto flex flex-col gap-0.5 pt-2 text-xs sm:flex-row sm:items-center sm:justify-between sm:pt-3 sm:text-sm">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 className="size-3.5 sm:size-4" aria-hidden="true" />{' '}
                      {formatDuration(service.duration_min)}
                    </span>
                    <span className="text-ink font-semibold">{formatCurrency(service.price)}</span>
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-1.5 sm:mt-3 sm:grid-cols-2 sm:gap-2">
                    <Button
                      type="button"
                      variant="accent"
                      size="sm"
                      onClick={() =>
                        addToCart({ kind: 'service', label: service.name, service }, toast)
                      }
                    >
                      <Plus className="size-4" aria-hidden="true" />
                      <span>
                        Add<span className="hidden sm:inline"> to Cart</span>
                      </span>
                    </Button>
                    <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                      <Link href={`/services/${service.slug}`}>Details</Link>
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {visibleServices.length === 0 && (
            <p className="text-ink-muted py-16 text-center">No services in this category yet.</p>
          )}

          <div className="mt-12 text-center">
            <Button asChild size="lg" variant="outline">
              <Link href="/services">
                View All Services <ArrowRight />
              </Link>
            </Button>
          </div>
        </div>
      </section>
      {/* 3. Deals — an admin-controlled bar (Settings > Deals Bar), then the offers as an auto-scrolling
          strip of cards at the gallery card size (one row on desktop, two opposing rows on phones and
          tablets). A card opens that deal's own page; the full catalog lives at /deals. */}
      {dealsBar && <DealsBar bar={dealsBar} />}
      {offers.length > 0 && (
        <section className="border-border-soft bg-accent-50 overflow-hidden border-y py-16 lg:py-20">
          <div className="mx-auto max-w-6xl px-6 text-center lg:px-10">
            <h2 className="font-display text-4xl font-medium text-balance sm:text-5xl lg:text-6xl">
              Special Deals
            </h2>
            <span
              className="bg-accent-500 mx-auto mt-4 block h-0.5 w-16 rounded-full"
              aria-hidden="true"
            />
            <p className="text-ink-muted mx-auto mt-4 max-w-xl leading-7">
              Packages and deals you can claim today.
            </p>
          </div>
          <div className="mt-10 px-6 md:px-12 lg:px-16">
            <DealsMarquee deals={offers} />
          </div>
          <div className="mt-10 px-6 text-center">
            <Button asChild variant="outline">
              <Link href="/deals">
                View All Deals <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* 4. Why Choose Us / Our Legacy — the one deliberately dark, high-contrast band on the page.
          Uses the theme's own ink/ivory/accent tokens rather than the reference screenshot's coral,
          per the brief's "use the existing app theme" rule. */}
      <section className="bg-ink text-ivory px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <div className="text-center">
            <p className="text-accent-300 text-sm font-semibold tracking-[0.22em] uppercase">
              Our legacy
            </p>
            <h2 className="font-display mt-4 text-4xl font-medium sm:text-5xl">
              Why Trust Looks Smart?
            </h2>
            <span
              className="bg-accent-500 mx-auto mt-5 block h-0.5 w-16 rounded-full"
              aria-hidden="true"
            />
            <p className="text-ivory/70 mx-auto mt-6 max-w-xl leading-7">
              Our signature bridal look has been a Lahore bride’s choice for 12 years, and many of
              those brides now bring their friends and family back for hair.
            </p>
          </div>

          <dl className="mt-14 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
            {legacyStats.map((stat) => {
              const Icon = LEGACY_ICONS[stat.icon] ?? Sparkles;

              return (
                <div
                  key={stat.label}
                  className="border-ivory/10 bg-ivory/5 rounded-xl border p-4 text-center sm:p-5"
                >
                  <span className="bg-accent-500/15 text-accent-300 mx-auto flex size-11 items-center justify-center rounded-xl">
                    <Icon className="size-5" aria-hidden="true" />
                  </span>
                  <dd className="mt-4 text-2xl font-semibold sm:text-3xl">{stat.value}</dd>
                  {/* `break-words` is load-bearing on narrow phones (320-400px): a single long
                      uppercase word with no space ("Transformations") has no natural wrap point, so
                      without it the label overflows the card's own border instead of wrapping — a
                      real, screenshotted bug (ad hoc task 27 fix), not a hypothetical one. Every
                      other label here happens to contain a space and wrapped fine already. */}
                  <dt className="text-accent-300 mt-1 text-xs font-semibold tracking-wider break-words uppercase">
                    {stat.label}
                  </dt>
                  <p className="text-ivory/60 mt-2 text-xs leading-5">{stat.detail}</p>
                </div>
              );
            })}
          </dl>
        </div>
      </section>

      {/* 5. Gallery auto-scroll carousel — directly below Why Choose Us, per the brief. The
          horizontal container padding keeps the cards off the screen edges; the marquee viewport
          itself still spans the full width inside it so the loop has room to run. */}
      {featuredGalleryImages.length > 0 && (
        <section className="border-border-soft bg-surface overflow-hidden border-y py-20 lg:py-24">
          <div className="mx-auto max-w-6xl px-6 text-center md:px-12 lg:px-16">
            <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">
              Looks Smart Brides
            </p>
            <h2 className="font-display mt-3 text-4xl font-medium">
              Moments of beauty and elegance from our real brides
            </h2>
          </div>
          <div className="mt-12 px-6 md:px-12 lg:px-16">
            <BridalMarquee images={featuredGalleryImages} />
          </div>
          <div className="mt-12 px-6 text-center md:px-12 lg:px-16">
            <Button asChild variant="outline">
              <Link href="/gallery">
                View Full Gallery <ArrowRight />
              </Link>
            </Button>
          </div>
        </section>
      )}

      {/* 6. Client reviews / testimonials — an auto-rotating carousel (3-up desktop, 1-up mobile,
          5-second fade, pause-on-hover) rather than the old static 3-card grid, so all 12 real
          organic + Google reviews the controller sends get shown, not just the first 3. */}
      {liveTestimonials.length > 0 && (
        <section className="px-6 py-20 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <div className="text-center">
              <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">
                Client notes
              </p>
              <h2 className="font-display mt-3 text-4xl font-medium">The feeling after.</h2>
            </div>
            <div className="mt-10">
              <ReviewsCarousel reviews={liveTestimonials} />
            </div>
            <div className="mt-10 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Button
                type="button"
                size="lg"
                variant="accent"
                onClick={() => setWriteReviewOpen(true)}
              >
                Write a Review
              </Button>
              <Button asChild size="lg" variant="outline">
                <a href={GOOGLE_REVIEWS_URL} target="_blank" rel="noopener noreferrer">
                  See more reviews on Google <ExternalLink className="size-4" aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>
        </section>
      )}
      <WriteReviewModal
        open={writeReviewOpen}
        onOpenChange={setWriteReviewOpen}
        onReviewSaved={(review) =>
          setLiveTestimonials((current) => [review, ...current].slice(0, 12))
        }
      />

      {/* 7. WhatsApp support & QR — directly below reviews. The QR is a server-generated SVG data
          URI (App\Support\QrCode), so there is no third-party QR service to be blocked by the CSP
          and no `dangerouslySetInnerHTML`. WhatsApp brand green is the one hardcoded colour the
          brief allows. */}
      <section className="px-6 py-20 md:px-12 lg:px-16 lg:py-24">
        <div className="border-border-soft bg-surface shadow-soft mx-auto max-w-5xl rounded-2xl border p-6 sm:p-10">
          <div className="grid items-center gap-8 md:grid-cols-[auto_1fr] md:gap-12">
            <div className="text-center">
              <div className="border-border-soft inline-block rounded-2xl border bg-white p-4">
                <img
                  src={whatsapp.qr_data_uri}
                  alt={`QR code opening a WhatsApp chat with Looks Smart Beauty Salon on ${whatsapp.display_phone}`}
                  width={200}
                  height={200}
                  className="size-[200px]"
                />
              </div>
              <p className="text-ink-muted mt-3 text-xs">📱 Scan with your camera</p>
            </div>

            <div>
              <span className="inline-flex items-center gap-2 rounded-full bg-[#25D366]/10 px-3 py-1 text-xs font-semibold text-[#128C7E]">
                <MessageCircle className="size-3.5" aria-hidden="true" /> Instant Support
              </span>
              <h2 className="font-display text-ink mt-4 text-3xl font-medium sm:text-4xl">
                Talk to us on WhatsApp
              </h2>
              <p className="text-ink-muted mt-4 leading-7">
                Book appointments, ask about services, request a quote, or get aftercare advice.
                Scan the QR code with your camera or tap below to start a chat with our team at{' '}
                <strong className="text-ink font-medium">{whatsapp.display_phone}</strong>.
              </p>
              <a
                href={whatsapp.chat_url}
                target="_blank"
                rel="noopener noreferrer"
                className="mt-6 inline-flex items-center gap-2 rounded-md bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1DA851] focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none"
              >
                <MessageCircle className="size-4" aria-hidden="true" /> Chat on WhatsApp
              </a>
            </div>
          </div>
        </div>
      </section>
      {/* 7. Visit us — address, hours, phone and an embedded map. Address/hours/phone come from the shared
          `site` prop (admin Settings + business_hours rows); the directions wording and Maps link from
          SeoService::findUs, so the same text Google reads is what visitors see. */}
      <section className="border-border-soft bg-surface border-y px-6 py-14 lg:px-10 lg:py-16">
        <div className="mx-auto grid max-w-6xl gap-8 lg:grid-cols-12 lg:gap-12">
          <div className="order-2 lg:order-1 lg:col-span-5">
            <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">
              Visit us
            </p>
            <h2 className="font-display mt-4 text-3xl font-medium text-balance sm:text-4xl">
              Come visit us in Central Park, Lahore
            </h2>
            <p className="text-ink-muted mt-4 leading-7">
              Find us on the Main Boulevard, beside UBL Bank and close to Gate No. 1. Book online or
              message us on WhatsApp and we will confirm your slot.
            </p>

            <div className="divide-border-soft border-border-soft mt-6 divide-y border-y">
              <div className="flex gap-4 py-4">
                <MapPin className="text-accent-700 mt-1 size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-medium">Find your way here</h3>
                  <a
                    href={findUs.mapsUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-ink-muted hover:text-accent-700 focus-visible:ring-accent-500 mt-1 block rounded text-sm leading-6 focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {site.address ?? findUs.address}
                  </a>
                  <p className="text-ink-muted mt-1 text-sm leading-6">{findUs.directions}.</p>
                </div>
              </div>

              <div className="flex gap-4 py-4">
                <Clock3 className="text-accent-700 mt-1 size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <h3 className="font-display text-lg font-medium">Make time for you</h3>
                    {openNow !== null && (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          openNow ? 'bg-accent-500/15 text-accent-700' : 'bg-ink/10 text-ink-muted'
                        }`}
                      >
                        {openNow ? 'Open now' : 'Closed now'}
                      </span>
                    )}
                  </div>
                  <div className="text-ink-muted mt-1 space-y-1 text-sm leading-6">
                    {(site.hours.length > 0 ? site.hours : [DEFAULT_HOURS_LABEL]).map((entry) => (
                      <p key={entry.days}>
                        {entry.days}: {entry.hours}
                      </p>
                    ))}
                  </div>
                </div>
              </div>

              <div className="flex gap-4 py-4">
                <Phone className="text-accent-700 mt-1 size-5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <h3 className="font-display text-lg font-medium">Call us</h3>
                  <a
                    href={`tel:${phoneDigits}`}
                    className="text-ink-muted hover:text-accent-700 focus-visible:ring-accent-500 mt-1 inline-block rounded text-sm focus-visible:ring-2 focus-visible:outline-none"
                  >
                    {phoneDisplay}
                  </a>
                </div>
              </div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <Button asChild variant="accent">
                <a href={whatsapp.chat_url} target="_blank" rel="noopener noreferrer">
                  <MessageCircle aria-hidden="true" /> Message on WhatsApp
                </a>
              </Button>
              <Button asChild variant="outline">
                <a href={findUs.mapsUrl} target="_blank" rel="noopener noreferrer">
                  Get directions <ExternalLink aria-hidden="true" />
                </a>
              </Button>
            </div>
          </div>

          <div className="relative order-1 lg:order-2 lg:col-span-7">
            <div className="shadow-soft border-border-soft bg-accent-50 h-[300px] overflow-hidden rounded-2xl rounded-tr-[4rem] border sm:h-[360px] lg:h-full lg:min-h-[420px]">
              <iframe
                title="Map showing Looks Smart Beauty Salon in Central Park Housing Scheme, Lahore"
                src="https://www.google.com/maps?q=31.317056,74.389306&output=embed"
                loading="lazy"
                referrerPolicy="no-referrer-when-downgrade"
                className="size-full border-0"
              />
            </div>
            <div className="bg-ivory/95 shadow-soft border-border-soft absolute right-3 bottom-3 left-3 rounded-xl border p-4 sm:right-auto sm:bottom-5 sm:left-5 sm:max-w-xs">
              <p className="font-display text-base font-semibold">Getting here</p>
              <p className="text-ink-muted mt-1 text-sm leading-6">
                Enter from Gate No. 1 (the main gate). We are in B Block, right on the Main
                Boulevard, next to UBL Bank.
              </p>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

Home.layout = (page: React.ReactNode) => <PublicLayout>{page}</PublicLayout>;
