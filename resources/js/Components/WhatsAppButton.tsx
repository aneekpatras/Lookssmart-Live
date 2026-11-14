import { usePage } from '@inertiajs/react';
import { MessageCircle } from 'lucide-react';

import { useStickyBarVisible } from '@/lib/overlay';

const GREETING = 'Hello Looks Smart Beauty Salon!';

/**
 * The pre-filled first message: the same plain greeting on every page, with a small tweak only on
 * the service, deals and booking pages. The visitor can edit it before sending.
 */
function messageFor(path: string, serviceName: string | null): string {
  if (/^\/services\/[^/]+/.test(path) && serviceName) {
    return `${GREETING} I'm interested in ${serviceName}. Could you share more details?`;
  }
  if (path.startsWith('/services')) {
    return `${GREETING} I'm interested in your services.`;
  }
  if (path.startsWith('/deals')) {
    return `${GREETING} I'm interested in your deals.`;
  }
  if (path.startsWith('/book')) {
    return `${GREETING} I'd like to book an appointment.`;
  }
  return `${GREETING} I'd like to know more about your services.`;
}

/** Same fallback `PublicWebsiteController::whatsappContact()` uses when no phone is configured. */
const FALLBACK_PHONE = '+92 305 9833859';

interface SharedProps {
  [key: string]: unknown;
  site: { phone: string | null };
  /** Only the service detail page passes this. */
  service?: { name?: string };
}

/**
 * Floating "chat on WhatsApp" button, shown on every public page (it lives in `PublicLayout`).
 *
 * The number is the admin-editable `business.phone` setting (shared as `site.phone`), so it can never
 * disagree with the footer or the Home WhatsApp section. `wa.me` wants digits only — no `+`, no
 * spaces. Opens in a new tab / the WhatsApp app with a message for the current page already typed in.
 *
 * On the booking page, below `lg`, a fixed "selected services" summary bar sits at the bottom of the
 * screen, so the button lifts above it there instead of covering its Continue button.
 */
export function WhatsAppButton() {
  const { props, url } = usePage<SharedProps>();
  const { site } = props;
  const path = url.split('?')[0] ?? url;

  const digits = (site.phone ?? FALLBACK_PHONE).replace(/\D/g, '');
  const href = `https://wa.me/${digits}?text=${encodeURIComponent(messageFor(path, props.service?.name ?? null))}`;
  const onBookingPage = path.startsWith('/book');
  const barVisible = useStickyBarVisible();

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Chat with us on WhatsApp"
      className={`group fixed right-4 z-30 items-center gap-2 rounded-full bg-[#25D366] p-3.5 text-white shadow-lg transition hover:scale-105 hover:shadow-xl focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none sm:right-6 sm:bottom-6 ${
        barVisible ? 'hidden md:flex' : 'flex'
      } ${onBookingPage ? 'bottom-24 lg:bottom-6' : 'bottom-5'}`}
    >
      <MessageCircle className="size-6" aria-hidden="true" />
      <span className="hidden max-w-0 overflow-hidden text-sm font-medium whitespace-nowrap transition-all duration-300 group-hover:max-w-40 group-hover:pr-1 group-focus-visible:max-w-40 group-focus-visible:pr-1 sm:inline">
        Chat with us
      </span>
    </a>
  );
}
