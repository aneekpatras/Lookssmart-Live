import { Link, usePage } from '@inertiajs/react';
import {
  ArrowRight,
  Award,
  Camera,
  Clock3,
  Heart,
  MapPin,
  MessageCircle,
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
import { DealDetailsModal, type DealShowcase } from '@/Components/DealDetailsModal';
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

interface HomeProps {
  findUs: { address: string; directions: string; mapsUrl: string };
  featuredServices: ServiceCard[];
  categories: { id: number; name: string }[];
  featured_gallery_images: MarqueeImage[];
  legacyStats: LegacyStat[];
  whatsapp: WhatsAppSupport;
  testimonials: ReviewShowcase[];
  offers: Offer[];
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
  const [allowVideo, setAllowVideo] = React.useState(false);
  const [failed, setFailed] = React.useState(false);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    const apply = () => setAllowVideo(!query.matches);

    apply();
    query.addEventListener('change', apply);

    return () => query.removeEventListener('change', apply);
  }, []);

  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !allowVideo) return;

    video.muted = true; // See (2) — required before play() for autoplay to be permitted.
    void video.play().catch(() => {
      // See (3): autoplay refused. The poster frame stays visible, so nothing more is needed.
    });
  }, [allowVideo]);

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
          src={HERO_POSTER}
          alt={HERO_POSTER_ALT}
          width={1600}
          height={900}
          fetchPriority="high"
          decoding="async"
          className="absolute inset-0 -z-20 size-full object-cover"
        />
      </picture>
      {allowVideo && !failed && (
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

/**
 * Compact homepage deal card: title + a discount-% badge (omitted when neither a real
 * `savings_percent` nor a percent-type `value` exists — never a fabricated number), a price
 * breakdown (strikethrough original + bold deal price when an admin has set both, falling back to
 * the plain "X% off"/"Rs. X off" line otherwise), a copyable promo-code tag, and a single Claim
 * Offer CTA straight into the booking flow.
 */
function OfferCard({ offer, onOpen }: { offer: Offer; onOpen: (offer: Offer) => void }) {
  const badgePercent =
    offer.savings_percent ?? (offer.type === 'percent' ? Number(offer.value) : null);

  function copyCode(code: string) {
    void navigator.clipboard.writeText(code).then(() => toast.success(`Code "${code}" copied`));
  }

  function handleAddToCart() {
    addToCart(
      {
        kind: 'deal',
        dealId: offer.id,
        label: offer.title,
        bundledServices: offer.bundled_services,
        originalPrice: offer.original_price,
        dealPrice: offer.deal_price,
      },
      toast,
    );
  }

  return (
    // Clicking anywhere on the card opens the Details popup. The title is the one real button (so
    // keyboard and screen-reader users get it too); its ::after stretches over the whole card, and the
    // inner controls (code chip, Add to Cart, Claim Offer) sit above that with `relative z-10`.
    <div className="border-accent-300 bg-surface hover:border-accent-500 relative flex cursor-pointer flex-col rounded-lg border p-5 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <h3 className="font-display text-lg leading-snug font-medium">
          <button
            type="button"
            onClick={() => onOpen(offer)}
            className="focus-visible:ring-accent-500 rounded text-left after:absolute after:inset-0 after:content-[''] focus-visible:ring-2 focus-visible:outline-none"
          >
            {offer.title}
          </button>
        </h3>
        {badgePercent !== null && badgePercent > 0 && (
          <span className="bg-accent-500 text-ivory shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold">
            {badgePercent}% OFF
          </span>
        )}
      </div>

      {offer.original_price && offer.deal_price ? (
        <p className="mt-3 flex items-baseline gap-2">
          <span className="text-ink-muted text-sm line-through">
            {formatCurrency(offer.original_price)}
          </span>
          <span className="text-ink font-display text-xl font-medium">
            {formatCurrency(offer.deal_price)}
          </span>
        </p>
      ) : (
        <p className="text-ink-muted mt-3 text-sm">
          {offer.type === 'percent' ? `${offer.value}% off` : `${formatCurrency(offer.value)} off`}
        </p>
      )}

      {offer.code && (
        <button
          type="button"
          onClick={() => copyCode(offer.code!)}
          className="border-accent-400 bg-accent-50 text-accent-700 relative z-10 mt-3 w-fit rounded-full border px-2.5 py-1 text-xs font-semibold"
        >
          Code: {offer.code}
        </button>
      )}

      <div className="relative z-10 mt-4 grid grid-cols-2 gap-2">
        <Button type="button" size="sm" variant="outline" onClick={handleAddToCart}>
          <Plus className="size-4" aria-hidden="true" /> Add to Cart
        </Button>
        <Button asChild size="sm" variant="accent">
          <Link href={offer.claim_url} prefetch>
            Claim Offer
          </Link>
        </Button>
      </div>
    </div>
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
}: HomeProps) {
  const { site } = usePage<SharedProps>().props;
  const [activeCategory, setActiveCategory] = React.useState<string>('all');
  const [writeReviewOpen, setWriteReviewOpen] = React.useState(false);
  const [detailsOffer, setDetailsOffer] = React.useState<Offer | null>(null);
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
      {/* 3. Deals / Current Offers — a compact, capped-at-6 grid; the full catalog lives at /deals. */}
      {offers.length > 0 && (
        <section className="border-border-soft bg-accent-50 border-y px-6 py-16 lg:px-10">
          <div className="mx-auto max-w-6xl">
            <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">
              Current offers
            </p>
            <div className="mt-5 grid grid-cols-1 gap-4 md:grid-cols-3">
              {offers.map((offer) => (
                <OfferCard key={offer.id} offer={offer} onOpen={setDetailsOffer} />
              ))}
            </div>
            <div className="mt-8 text-center">
              <Button asChild variant="outline">
                <Link href="/deals">
                  View All Deals <ArrowRight className="size-4" aria-hidden="true" />
                </Link>
              </Button>
            </div>
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
              Twelve years of precision styling and signature bridal artistry, setting the standard
              for considered beauty care in Lahore.
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
      {detailsOffer && (
        <DealDetailsModal
          deal={detailsOffer}
          open={detailsOffer !== null}
          onOpenChange={(open) => {
            if (!open) setDetailsOffer(null);
          }}
          whatsappUrl={whatsapp.chat_url}
        />
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
      {/* Address and hours read from the shared `site` prop (admin-editable Settings + the real
          business_hours rows). These were previously hardcoded as "123 Beauty Lane" and
          "Monday–Saturday 9:00 am–7:00 pm" — placeholder text that survived the content sync
          because that task only reworked the footer, and which contradicted both the real address
          and the salon's actual seven-day 10:00–21:00 hours. */}
      <section className="border-border-soft bg-surface border-y px-6 py-16 lg:px-10">
        <div className="mx-auto grid max-w-6xl gap-8 sm:grid-cols-3">
          <div>
            <MapPin className="text-accent-700 size-5" aria-hidden="true" />
            <h2 className="mt-3 text-xl">Find your way here</h2>
            <p className="text-ink-muted mt-2 text-sm">{site.address ?? findUs.address}</p>
            {/* Plain-language directions + a real Google Maps link (SeoService::findUs — the owner's
                wording and verified map pin), in the page HTML so people and crawlers both see it. */}
            <p className="text-ink-muted mt-2 text-sm">{findUs.directions}.</p>
            <a
              href={findUs.mapsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-700 hover:text-accent-600 mt-3 inline-flex items-center gap-1.5 text-sm font-medium"
            >
              Get directions on Google Maps <ExternalLink className="size-4" aria-hidden="true" />
            </a>
          </div>
          <div>
            <Clock3 className="text-accent-700 size-5" aria-hidden="true" />
            <h2 className="mt-3 text-xl">Make time for you</h2>
            <div className="text-ink-muted mt-2 space-y-1 text-sm">
              {site.hours.length > 0 ? (
                site.hours.map((entry) => (
                  <p key={entry.days}>
                    {entry.days}
                    <br />
                    {entry.hours}
                  </p>
                ))
              ) : (
                <p>Please contact us for our current opening hours.</p>
              )}
            </div>
          </div>
          <div>
            <Sparkles className="text-accent-700 size-5" aria-hidden="true" />
            <h2 className="mt-3 text-xl">A beautiful finish</h2>
            <p className="text-ink-muted mt-2 text-sm">
              Thoughtful service, skilled hands, and time that feels like yours.
            </p>
          </div>
        </div>
      </section>
    </>
  );
}

Home.layout = (page: React.ReactNode) => <PublicLayout>{page}</PublicLayout>;
