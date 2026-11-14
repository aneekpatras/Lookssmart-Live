import { Link, usePage } from '@inertiajs/react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import {
  ArrowUp,
  CalendarCheck,
  CircleHelp,
  Clock,
  Footprints,
  Mail,
  MapPin,
  Menu,
  MessageCircle,
  Phone,
  ShieldCheck,
  Sparkles,
  Wifi,
  X,
} from 'lucide-react';
import * as React from 'react';

import { Button } from '@/Components/ui/button';
import { CartToast } from '@/Components/CartToast';
import { Toaster } from '@/Components/ui/toaster';
import { FacebookIcon, InstagramIcon } from '@/Components/SocialIcons';
import { HeaderCartButton } from '@/Components/HeaderCartButton';
import { HeaderUserMenu } from '@/Components/HeaderUserMenu';
import { NavigationProgressOverlay } from '@/Components/NavigationProgressOverlay';
import { SmoothScroll } from '@/Components/SmoothScroll';
import { WhatsAppButton } from '@/Components/WhatsAppButton';
import { WhatsAppPopup } from '@/Components/WhatsAppPopup';
import { useRegisterOverlay } from '@/lib/overlay';

/**
 * The globally shared `site` block (HandleInertiaRequests::share) — contact details, social
 * profiles and a collapsed opening-hours summary, all sourced from admin-editable Settings and the
 * real `business_hours` rows. Declared locally, matching SeoHead.tsx's pattern for shared props.
 *
 * Named `site` rather than `business` on purpose: Contact and PrivacyPolicy each pass their own
 * page-level `business` prop, and Inertia's shallow prop merge would shadow this object entirely.
 */
interface SharedProps {
  [key: string]: unknown;
  site: {
    name: string;
    phone: string | null;
    email: string | null;
    address: string | null;
    facebook: string | null;
    instagram: string | null;
    hours: { days: string; hours: string }[];
    whatsapp_url: string;
    directions_url: string;
    service_categories: { id: number; name: string }[];
  };
  auth: { user: { name: string; email: string } | null };
}

const NAV_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Deals', href: '/deals' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
];

function FloatingNav({ solidHeader }: { solidHeader: boolean }) {
  const [scrolled, setScrolled] = React.useState(false);
  const [mobileOpen, setMobileOpen] = React.useState(false);
  useRegisterOverlay('menu', mobileOpen);
  const page = usePage<SharedProps>();
  const { url } = page;
  const { auth, site } = page.props;

  React.useEffect(() => {
    function onScroll() {
      setScrolled(window.scrollY > 16);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  // Card-dense catalog pages (Services/Deals/Book) opt into a fully solid nav background instead of
  // the decorative `glass` (translucent + blurred) look every other page keeps — over a hero image
  // or a short page, `glass` reads as intentional; over a long, constantly-scrolling grid of cards
  // passing directly underneath a `fixed` header, the same translucency lets card text visibly bleed
  // through it (a real, screenshotted bug, ad hoc task 26 fix — not merely a hypothetical one).
  const navSurfaceClass = solidHeader ? 'bg-ivory border-border-soft border shadow-soft' : 'glass';

  return (
    <header
      className={`fixed inset-x-0 top-0 z-40 flex justify-center px-4 pt-4 transition-transform duration-300 [html[data-header-hidden=true]_&]:-translate-y-[110%] ${solidHeader ? 'bg-ivory' : ''}`}
    >
      <nav
        className={`${navSurfaceClass} motion-safe-transition flex w-full max-w-5xl items-center justify-between rounded-full px-5 transition-[padding,box-shadow] duration-300 ${
          scrolled ? 'py-2' : 'py-3'
        }`}
      >
        <Link href="/" className="font-display text-ink text-lg font-medium">
          Looks Smart
        </Link>

        <ul className="hidden items-center gap-6 md:flex">
          {NAV_LINKS.map((link) => (
            <li key={link.href}>
              <Link
                href={link.href}
                className={`motion-safe-transition hover:text-accent-600 text-sm transition-colors ${
                  url === link.href ? 'text-accent-600' : 'text-ink-muted'
                }`}
              >
                {link.label}
              </Link>
            </li>
          ))}
        </ul>

        {/* Cart + account render EXACTLY ONCE (not once per breakpoint) — each carries its own
            internal open/closed state (a Sheet drawer, a dropdown/auth modal), and mounting two
            separate copies simultaneously (one hidden via `md:hidden`, one via `hidden md:flex`)
            caused a genuine render crash, not just a mismatched selector in a test (ad hoc task 27
            fix). "Book Now" and the hamburger toggle are the only pieces that actually differ
            between breakpoints, so THEY are what gets shown/hidden with `md:` utilities — the cart
            and account icons stay visible on both, giving mobile the always-one-tap access the task
            asked for "for free", without duplicating any stateful component. */}
        <div className="flex items-center gap-1.5 sm:gap-3">
          <HeaderCartButton />
          <Button asChild size="sm" variant="accent" className="hidden md:inline-flex">
            <Link href="/book">
              <CalendarCheck className="size-4" aria-hidden="true" /> Book Now
            </Link>
          </Button>
          <HeaderUserMenu user={auth.user} />
          <button
            type="button"
            className="text-ink rounded-md p-2 md:hidden"
            aria-label={mobileOpen ? 'Close menu' : 'Open menu'}
            aria-expanded={mobileOpen}
            onClick={() => setMobileOpen((open) => !open)}
          >
            {mobileOpen ? <X className="size-5" /> : <Menu className="size-5" />}
          </button>
        </div>
      </nav>

      {mobileOpen ? (
        <div className="bg-ivory border-border-soft shadow-soft absolute inset-x-4 top-[4.5rem] z-40 flex flex-col gap-1 rounded-2xl border p-4 md:hidden">
          {NAV_LINKS.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="text-ink hover:bg-accent-50 rounded-md px-3 py-2 text-sm"
              onClick={() => setMobileOpen(false)}
            >
              {link.label}
            </Link>
          ))}
          <Button asChild variant="accent" className="mt-3 w-full">
            <Link href="/book" onClick={() => setMobileOpen(false)}>
              <CalendarCheck className="size-4" aria-hidden="true" /> Book Now
            </Link>
          </Button>
          <div className="mt-2 grid grid-cols-2 gap-2">
            <Button asChild variant="outline">
              <Link href="/faqs" onClick={() => setMobileOpen(false)}>
                <CircleHelp className="size-4" aria-hidden="true" /> FAQs
              </Link>
            </Button>
            <Button asChild variant="outline">
              <a
                href={site.whatsapp_url}
                target="_blank"
                rel="noopener noreferrer"
                onClick={() => setMobileOpen(false)}
              >
                <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
              </a>
            </Button>
          </div>
        </div>
      ) : null}
    </header>
  );
}

const FOOTER_LINKS = [
  { label: 'Home', href: '/' },
  { label: 'About', href: '/about' },
  { label: 'Services', href: '/services' },
  { label: 'Deals', href: '/deals' },
  { label: 'Gallery', href: '/gallery' },
  { label: 'Blog', href: '/blog' },
  { label: 'Contact', href: '/contact' },
  { label: 'FAQs', href: '/faqs' },
  { label: 'Privacy Policy', href: '/privacy-policy' },
];

const TRUST_ITEMS = [
  { icon: ShieldCheck, label: 'Women-only salon' },
  { icon: Sparkles, label: '12 years of bridal artistry' },
  { icon: Footprints, label: 'Walk-ins welcome' },
  { icon: Wifi, label: 'Parking and internet available' },
];

const footerLink =
  'hover:text-accent-600 inline-flex min-h-10 items-center transition-colors sm:min-h-0 sm:py-0.5';

/**
 * Every value here comes from the globally shared `site` prop (HandleInertiaRequests::share): the
 * admin-editable Settings, the real `business_hours` rows and the active service categories, so the
 * address, phone and hours always match the Visit us section and the LocalBusiness schema. Each block is
 * conditional: an unconfigured setting renders as absent rather than as a made-up placeholder.
 */
function Footer() {
  const { site } = usePage<SharedProps>().props;
  const phoneHref = site.phone ? `tel:${site.phone.replace(/[^\d+]/g, '')}` : undefined;

  return (
    <footer className="border-border-soft bg-surface border-t pb-24 md:pb-0">
      <div className="border-border-soft border-b px-6 py-6">
        <ul className="mx-auto grid max-w-6xl grid-cols-2 gap-4 lg:grid-cols-4">
          {TRUST_ITEMS.map(({ icon: Icon, label }) => (
            <li key={label} className="text-ink flex items-center gap-2.5 text-sm">
              <Icon className="text-accent-700 size-5 shrink-0" aria-hidden="true" />
              <span>{label}</span>
            </li>
          ))}
        </ul>
      </div>

      <div className="mx-auto grid max-w-6xl grid-cols-2 gap-x-6 gap-y-10 px-6 py-12 lg:grid-cols-4 lg:gap-x-10">
        <div className="col-span-2 lg:col-span-1">
          <p className="font-display text-ink text-lg font-medium">{site.name}</p>
          <p className="text-ink-muted mt-2 text-sm">
            Precision hair styling, signature makeup artistry, and personal consultation — in the
            heart of Lahore.
          </p>
          {(site.facebook || site.instagram) && (
            <div className="mt-4 flex items-center gap-1">
              {site.facebook && (
                <a
                  href={site.facebook}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Looks Smart Beauty Salon on Facebook"
                  className="text-ink-muted hover:text-accent-600 flex size-10 items-center justify-center transition-colors"
                >
                  <FacebookIcon className="h-5 w-5" aria-hidden="true" />
                </a>
              )}
              {site.instagram && (
                <a
                  href={site.instagram}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label="Looks Smart Beauty Salon on Instagram"
                  className="text-ink-muted hover:text-accent-600 flex size-10 items-center justify-center transition-colors"
                >
                  <InstagramIcon className="h-5 w-5" aria-hidden="true" />
                </a>
              )}
            </div>
          )}
          <Button asChild className="mt-4">
            <Link href="/book">
              <CalendarCheck className="size-4" aria-hidden="true" /> Book Now
            </Link>
          </Button>
        </div>

        {site.service_categories.length > 0 && (
          <div className="text-ink-muted text-sm">
            <p className="text-ink font-medium">Services</p>
            <ul className="mt-2 space-y-0.5">
              {site.service_categories.map((category) => (
                <li key={category.id}>
                  <Link href={`/services#services-category-${category.id}`} className={footerLink}>
                    {category.name}
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="text-ink-muted text-sm">
          <p className="text-ink font-medium">Quick links</p>
          <ul className="mt-2 space-y-0.5">
            {FOOTER_LINKS.map((link) => (
              <li key={link.href}>
                <Link href={link.href} className={footerLink}>
                  {link.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>

        <div className="text-ink-muted col-span-2 text-sm lg:col-span-1">
          <p className="text-ink font-medium">Visit us</p>
          <ul className="mt-2 space-y-2">
            {site.address && (
              <li className="flex gap-2">
                <MapPin className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <a
                  href={site.directions_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent-600 transition-colors"
                >
                  {site.address}
                </a>
              </li>
            )}
            {site.phone && (
              <li className="flex gap-2">
                <Phone className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <a href={phoneHref} className="hover:text-accent-600 transition-colors">
                  {site.phone}
                </a>
              </li>
            )}
            {site.phone && (
              <li className="flex gap-2">
                <MessageCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <a
                  href={site.whatsapp_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent-600 transition-colors"
                >
                  Chat on WhatsApp
                </a>
              </li>
            )}
            {site.hours.length > 0 && (
              <li className="flex gap-2">
                <Clock className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <span>
                  {site.hours.map((entry) => (
                    <span key={entry.days} className="block">
                      {entry.days}: {entry.hours}
                    </span>
                  ))}
                </span>
              </li>
            )}
            {site.email && (
              <li className="flex gap-2">
                <Mail className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                <a
                  href={`mailto:${site.email}`}
                  className="hover:text-accent-600 break-all transition-colors"
                >
                  {site.email}
                </a>
              </li>
            )}
          </ul>
        </div>
      </div>

      <div className="border-border-soft border-t px-6 py-5">
        <div className="text-ink-muted mx-auto flex max-w-6xl flex-col gap-3 text-xs md:flex-row md:items-center md:justify-between">
          <p>
            © 2026 {site.name}. All rights reserved.{' '}
            <Link
              href="/privacy-policy"
              className="hover:text-accent-600 underline-offset-2 hover:underline"
            >
              Privacy Policy
            </Link>
          </p>
          <p>We accept cash, bank transfer, JazzCash and Easypaisa.</p>
          <button
            type="button"
            onClick={() => window.scrollTo({ top: 0, behavior: 'smooth' })}
            className="hover:text-accent-600 inline-flex min-h-10 items-center gap-1.5 self-start transition-colors md:self-auto"
          >
            <ArrowUp className="size-4" aria-hidden="true" /> Back to top
          </button>
        </div>
      </div>
    </footer>
  );
}

export default function PublicLayout({
  children,
  solidHeader = false,
}: {
  children: React.ReactNode;
  /** Card-dense catalog pages (Services/Deals/Book) pass this to render the floating nav on a solid
   * background rather than the default translucent `glass` look — see `FloatingNav` for why. */
  solidHeader?: boolean;
}) {
  const { url } = usePage();
  const prefersReducedMotion = useReducedMotion();

  return (
    <SmoothScroll>
      <div className="flex min-h-screen flex-col">
        <a
          href="#main-content"
          className="bg-ink text-ivory sr-only fixed top-4 left-4 z-50 rounded-md px-4 py-2 text-sm font-medium focus:not-sr-only"
        >
          Skip to main content
        </a>
        <FloatingNav solidHeader={solidHeader} />
        <Toaster />
        <CartToast />
        <NavigationProgressOverlay />
        <main id="main-content" className="flex-1 pt-24">
          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={url}
              initial={prefersReducedMotion ? undefined : { opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={prefersReducedMotion ? undefined : { opacity: 0, y: -8 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
            >
              {children}
            </motion.div>
          </AnimatePresence>
        </main>
        <Footer />
        <WhatsAppButton />
        <WhatsAppPopup />
      </div>
    </SmoothScroll>
  );
}
