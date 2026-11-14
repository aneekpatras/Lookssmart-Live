import { Link, usePage } from '@inertiajs/react';
import { CalendarCheck, MessageCircle } from 'lucide-react';

import { Button } from '@/Components/ui/button';
import { useStickyBarVisible } from '@/lib/overlay';

/**
 * Slim bottom bar for phones (below md): "Book Now" and "WhatsApp". Appears after about 300px of
 * scrolling; hidden on /book, admin, auth and error pages and while the cart drawer or mobile menu is
 * open. Respects the iPhone safe-area inset. The footer carries matching bottom padding.
 */
export function StickyMobileBar() {
  const { site } = usePage<{ [key: string]: unknown; site: { whatsapp_url: string } }>().props;
  const visible = useStickyBarVisible();

  return (
    <div
      aria-hidden={!visible}
      className={`border-border-soft bg-ivory shadow-glass fixed inset-x-0 bottom-0 z-30 border-t px-4 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))] transition duration-200 motion-reduce:transition-opacity md:hidden ${
        visible ? 'translate-y-0 opacity-100' : 'pointer-events-none translate-y-full opacity-0'
      }`}
    >
      <div className="grid grid-cols-2 gap-2">
        <Button asChild variant="accent" tabIndex={visible ? 0 : -1}>
          <Link href="/book" tabIndex={visible ? 0 : -1}>
            <CalendarCheck className="size-4" aria-hidden="true" /> Book Now
          </Link>
        </Button>
        <Button asChild variant="outline">
          <a
            href={site.whatsapp_url}
            target="_blank"
            rel="noopener noreferrer"
            tabIndex={visible ? 0 : -1}
          >
            <MessageCircle className="size-4" aria-hidden="true" /> WhatsApp
          </a>
        </Button>
      </div>
    </div>
  );
}
