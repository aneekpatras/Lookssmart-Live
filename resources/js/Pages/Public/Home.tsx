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

import { Reveal } from '@/Components/Reveal';
import { BridalMarquee, type MarqueeImage } from '@/Components/BridalMarquee';
import { ReviewsCarousel, type ReviewShowcase } from '@/Components/ReviewsCarousel';
import { SeoHead } from '@/Components/SeoHead';
import type { FaqItem } from '@/Components/FaqAccordion';
import { FaqPreview } from '@/Components/FaqPreview';
import { CartAddButton } from '@/Components/CartAddButton';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import type { DealShowcase } from '@/Components/DealDetailsModal';
import { DealsBar, DealsMarquee, type DealsBarData } from '@/Components/DealsShowcase';
import { HomeShowcase, type ShowcaseData } from '@/Components/HomeShowcase';
import { WriteReviewModal } from '@/Components/WriteReviewModal';
import PublicLayout from '@/Layouts/PublicLayout';
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
  faqPreview: FaqItem[];
  featuredServices: ServiceCard[];
  categories: { id: number; name: string }[];
  featured_gallery_images: MarqueeImage[];
  legacyStats: LegacyStat[];
  openingHours: OpeningHour[];
  whatsapp: WhatsAppSupport;
  testimonials: ReviewShowcase[];
  offers: Offer[];
  dealsBar: DealsBarData | null;
  showcase: ShowcaseData | null;
  hero: HeroMedia;
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

/** The hero video and poster the server chose (Admin > Settings > Home hero, else the defaults). */
interface HeroMedia {
  video_url: string | null;
  poster_url: string | null;
  source?: 'youtube' | 'local';
  youtube_id?: string | null;
}

const YT_ORIGIN = 'https://www.youtube-nocookie.com';

/**
 * Client-only YouTube background. Nothing here renders on the server: the iframe is mounted by the first
 * client effect after hydration, only while the hero is on screen and the tab is visible. It stays fully
 * transparent (so YouTube's spinner and buttons are never seen) until YouTube reports that playback has
 * really started, then fades in over the dark hero layer. If playback is not confirmed within ~8 seconds,
 * `onFail` is called: the iframe is removed and the parent shows the fallback poster. The parent decides
 * reduced motion / data saver before this is rendered.
 */
function YoutubeHeroVideo({ id, onFail }: { id: string; onFail: () => void }) {
  const wrapRef = React.useRef<HTMLDivElement>(null);
  const [onScreen, setOnScreen] = React.useState(true);
  const [tabVisible, setTabVisible] = React.useState(() => !document.hidden);

  React.useEffect(() => {
    const wrap = wrapRef.current;
    if (!wrap) return;

    const observer = new IntersectionObserver(([entry]) =>
      setOnScreen(entry?.isIntersecting ?? true),
    );
    observer.observe(wrap);
    const onVisibility = () => setTabVisible(!document.hidden);
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, []);

  return (
    <div
      ref={wrapRef}
      aria-hidden="true"
      className="[container-type:size] pointer-events-none absolute inset-0 -z-20 overflow-hidden"
    >
      {onScreen && tabVisible && <YoutubeFrame id={id} onFail={onFail} />}
    </div>
  );
}

/** What a YouTube widget message tells us: player state (1 playing, 2 paused, 0 ended) and the clock. */
function parseYoutube(
  raw: unknown,
): { state: number | null; time: number; duration: number } | null {
  if (typeof raw !== 'string') return null;
  try {
    const data = JSON.parse(raw) as { event?: string; info?: unknown };
    if (data.event === 'onStateChange' && typeof data.info === 'number') {
      return { state: data.info, time: 0, duration: 0 };
    }
    if (data.event === 'infoDelivery' && data.info && typeof data.info === 'object') {
      const info = data.info as {
        playerState?: unknown;
        currentTime?: unknown;
        duration?: unknown;
      };
      return {
        state: typeof info.playerState === 'number' ? info.playerState : null,
        time: typeof info.currentTime === 'number' ? info.currentTime : 0,
        duration: typeof info.duration === 'number' ? info.duration : 0,
      };
    }
  } catch {
    // Not a YouTube message.
  }

  return null;
}

/**
 * The iframe itself: its own state, so every (re)mount starts transparent and fades in once playing. After it
 * has played it stays visible: the loop is done by seeking back to 0 just before the end (no playlist, so
 * YouTube shows no previous/next buttons and never reloads the video).
 */
function YoutubeFrame({ id, onFail }: { id: string; onFail: () => void }) {
  const frameRef = React.useRef<HTMLIFrameElement>(null);
  const [playing, setPlaying] = React.useState(false);
  const everPlayed = React.useRef(false);

  React.useEffect(() => {
    let lastSeek = 0;
    const command = (func: string, args: unknown[] = []) =>
      frameRef.current?.contentWindow?.postMessage(
        JSON.stringify({ event: 'command', func, args }),
        YT_ORIGIN,
      );
    const restart = () => {
      const now = Date.now();
      if (now - lastSeek < 1500) return;
      lastSeek = now;
      command('seekTo', [0, true]);
      command('playVideo');
    };

    const onMessage = (event: MessageEvent) => {
      if (event.origin !== YT_ORIGIN || event.source !== frameRef.current?.contentWindow) return;

      const info = parseYoutube(event.data);
      if (!info) return;

      if (info.state === 1) {
        everPlayed.current = true;
        setPlaying(true);
      } else if (info.state === 0 || (info.state === 2 && everPlayed.current)) {
        restart(); // ended or paused by YouTube itself: keep playing, never fade out
      }
      if (info.duration > 1 && info.time >= info.duration - 0.6) restart();
    };
    window.addEventListener('message', onMessage);

    return () => window.removeEventListener('message', onMessage);
  }, []);

  React.useEffect(() => {
    const timer = window.setTimeout(() => {
      if (!everPlayed.current) onFail();
    }, 8000);

    return () => window.clearTimeout(timer);
  }, [onFail]);

  const src =
    `${YT_ORIGIN}/embed/${id}?autoplay=1&mute=1&controls=0&modestbranding=1&rel=0` +
    `&playsinline=1&disablekb=1&iv_load_policy=3&fs=0&cc_load_policy=0&enablejsapi=1` +
    `&origin=${encodeURIComponent(window.location.origin)}`;

  return (
    <iframe
      ref={frameRef}
      title="Looks Smart Beauty Salon video"
      src={src}
      referrerPolicy="strict-origin-when-cross-origin"
      allow="autoplay; encrypted-media"
      tabIndex={-1}
      aria-hidden="true"
      onLoad={() => {
        // Ask the player to report its state to us (no YouTube API script needed).
        frameRef.current?.contentWindow?.postMessage(
          JSON.stringify({ event: 'listening', id: 1, channel: 'widget' }),
          YT_ORIGIN,
        );
      }}
      className={`pointer-events-none absolute top-1/2 left-1/2 h-[max(100cqh,56.25cqw)] w-[max(100cqw,177.78cqh)] max-w-none -translate-x-1/2 -translate-y-1/2 border-0 transition-opacity duration-700 ${playing ? 'opacity-100' : 'opacity-0'}`}
    />
  );
}

// Real photo of the salon. For the YouTube source it is only a fallback (reduced motion, data saver, a
// failed or slow video); for the local-file source it is shown from the first paint as before. Desktop is
// 1600x900, mobile 900x1200; WebP first with a JPG fallback. The breakpoint (768px) must match the
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
function HeroBackground({ hero }: { hero: HeroMedia }) {
  const videoRef = React.useRef<HTMLVideoElement>(null);
  const posterRef = React.useRef<HTMLImageElement>(null);
  const [allowVideo, setAllowVideo] = React.useState(false);
  const [posterReady, setPosterReady] = React.useState(false);
  const [failed, setFailed] = React.useState(false);
  // YouTube source: no image before the video. The poster is only a fallback, shown once we know the
  // video cannot play (reduced motion, data saver / 2g) or it failed to start within ~8 seconds.
  const isYoutube = Boolean(hero.youtube_id);
  const [mediaChecked, setMediaChecked] = React.useState(false);
  const [ytFailed, setYtFailed] = React.useState(false);
  const onYoutubeFail = React.useCallback(() => setYtFailed(true), []);
  const showPoster = !isYoutube || ytFailed || (mediaChecked && !allowVideo);

  React.useEffect(() => {
    const query = window.matchMedia('(prefers-reduced-motion: reduce)');
    // Poster only for reduced motion, data saver and 2g connections.
    const connection = (
      navigator as Navigator & { connection?: { saveData?: boolean; effectiveType?: string } }
    ).connection;
    const lowData = connection?.saveData === true || connection?.effectiveType === '2g';
    const apply = () => {
      setAllowVideo(!query.matches && !lowData);
      setMediaChecked(true);
    };

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

  // Pause while the hero is off screen or the tab is hidden; resume when it is visible again.
  React.useEffect(() => {
    const video = videoRef.current;
    if (!video || !allowVideo || !posterReady) return;

    let onScreen = true;
    const sync = () => {
      if (onScreen && document.visibilityState === 'visible') {
        void video.play().catch(() => {});
      } else {
        video.pause();
      }
    };
    const observer = new IntersectionObserver(([entry]) => {
      onScreen = entry?.isIntersecting ?? true;
      sync();
    });
    observer.observe(video);
    document.addEventListener('visibilitychange', sync);

    return () => {
      observer.disconnect();
      document.removeEventListener('visibilitychange', sync);
    };
  }, [allowVideo, posterReady]);

  // The poster is always rendered, as the base layer: it paints first (high priority, never lazy,
  // fixed size so nothing shifts) and the video, when allowed, plays on top of it. Keeping one
  // permanent <img> also means the swap to video never flashes, and the photo keeps its alt text.
  return (
    <>
      {showPoster &&
        (hero.poster_url ? (
          <img
            ref={posterRef}
            data-hero-poster
            src={hero.poster_url}
            alt={HERO_POSTER_ALT}
            width={1600}
            height={900}
            fetchPriority="high"
            decoding="async"
            className="absolute inset-0 -z-20 size-full object-cover"
          />
        ) : (
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
        ))}
      {allowVideo && !ytFailed && hero.youtube_id && (
        <YoutubeHeroVideo id={hero.youtube_id} onFail={onYoutubeFail} />
      )}
      {allowVideo && posterReady && !failed && !hero.youtube_id && hero.video_url && (
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
          <source
            src={hero.video_url}
            type={hero.video_url.toLowerCase().endsWith('.webm') ? 'video/webm' : 'video/mp4'}
          />
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
  faqPreview,
  openingHours,
  dealsBar,
  showcase,
  hero,
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
      <section
        className={`text-ivory relative isolate flex items-center overflow-hidden px-6 lg:px-10 ${
          hero.youtube_id
            ? 'bg-ink -mt-24 min-h-[calc(88svh+6rem)] pt-48 pb-24'
            : 'min-h-[88svh] py-24'
        }`}
      >
        <HeroBackground hero={hero} />
        {/* Two stacked layers: a warm champagne wash for brand tone, then a dark vertical gradient
            that guarantees text contrast regardless of what the video frame underneath is doing. */}
        <div
          className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_75%_22%,color-mix(in_srgb,var(--gold)_28%,transparent),transparent_45%),linear-gradient(180deg,rgba(23,19,17,0.72)_0%,rgba(23,19,17,0.58)_45%,rgba(23,19,17,0.86)_100%)]"
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

      {/* 3. Deals — an admin-controlled bar (Settings > Deals Bar), then the offers as an auto-scrolling
          strip of cards at the gallery card size (one row on desktop, two opposing rows on phones and
          tablets). A card opens that deal's own page; the full catalog lives at /deals. */}
      {showcase && <HomeShowcase showcase={showcase} />}
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

      {/* Our Specialized Services — category-filterable, 4 across on desktop */}
      <section className="px-6 py-14 sm:py-20 lg:px-10 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
            <h2 className="font-display text-3xl font-medium sm:text-5xl">
              Our Specialized Services
            </h2>
            <p className="text-ink-muted mx-auto mt-3 max-w-xl text-base sm:mt-4 sm:text-lg">
              Experience premium skin, hair, and beauty treatments in Lahore.
            </p>
          </Reveal>

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
              <Reveal key={service.id} className="h-full">
                <Card className="border-border-soft bg-surface shadow-soft flex h-full flex-col overflow-hidden transition-[transform,box-shadow] duration-200 [@media(hover:hover)]:hover:-translate-y-0.5 [@media(hover:hover)]:hover:shadow-md">
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
                      <span className="text-ink font-semibold">
                        {formatCurrency(service.price)}
                      </span>
                    </div>
                    <div className="mt-2 grid grid-cols-1 gap-1.5 sm:mt-3 sm:grid-cols-2 sm:gap-2">
                      <CartAddButton
                        variant="accent"
                        size="sm"
                        input={{ kind: 'service', label: service.name, service }}
                      >
                        <Plus className="size-4" aria-hidden="true" />
                        <span>
                          Add<span className="hidden sm:inline"> to Cart</span>
                        </span>
                      </CartAddButton>
                      <Button asChild variant="outline" size="sm" className="hidden sm:inline-flex">
                        <Link href={`/services/${service.slug}`}>Details</Link>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              </Reveal>
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
      {/* 4. Why Choose Us / Our Legacy — the one deliberately dark, high-contrast band on the page.
          Uses the theme's own ink/ivory/accent tokens rather than the reference screenshot's coral,
          per the brief's "use the existing app theme" rule. */}
      <section className="bg-ink text-ivory px-6 py-20 lg:px-16 lg:py-28">
        <div className="mx-auto max-w-6xl">
          <Reveal className="text-center">
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
          </Reveal>

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
          <Reveal className="mx-auto max-w-6xl px-6 text-center md:px-12 lg:px-16">
            <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">
              Looks Smart Brides
            </p>
            <h2 className="font-display mt-3 text-4xl font-medium">
              Moments of beauty and elegance from our real brides
            </h2>
          </Reveal>
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
            <Reveal className="text-center">
              <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">
                Client notes
              </p>
              <h2 className="font-display mt-3 text-4xl font-medium">The feeling after.</h2>
            </Reveal>
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

      <FaqPreview items={faqPreview} />

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
