import { Check } from 'lucide-react';
import * as React from 'react';

import { CART_ADDED_EVENT, type CartAddedDetail, OPEN_CART_EVENT } from '@/lib/cart';

const VISIBLE_MS = 2800;

/**
 * Small "added to cart" popup. Built without Sonner on purpose: Sonner injects a <style> tag and
 * inline style attributes, which this site's Content-Security-Policy blocks, so it renders unstyled.
 * Tailwind classes only. One popup at a time; a new add replaces it.
 */
export function CartToast() {
  const [detail, setDetail] = React.useState<CartAddedDetail | null>(null);
  const [shown, setShown] = React.useState(false);
  const timer = React.useRef<number | undefined>(undefined);

  const hideSoon = React.useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => {
      setShown(false);
      timer.current = window.setTimeout(() => setDetail(null), 220);
    }, VISIBLE_MS);
  }, []);

  React.useEffect(() => {
    function onAdded(event: Event) {
      setDetail((event as CustomEvent<CartAddedDetail>).detail);
      // Mount hidden, then fade/slide in on the next frame.
      setShown(false);
      window.requestAnimationFrame(() => setShown(true));
      hideSoon();
    }
    window.addEventListener(CART_ADDED_EVENT, onAdded);
    return () => {
      window.removeEventListener(CART_ADDED_EVENT, onAdded);
      window.clearTimeout(timer.current);
    };
  }, [hideSoon]);

  if (!detail) return null;

  return (
    <div
      role="status"
      aria-live="polite"
      onMouseEnter={() => window.clearTimeout(timer.current)}
      onMouseLeave={hideSoon}
      onFocus={() => window.clearTimeout(timer.current)}
      onBlur={hideSoon}
      className={`border-border-soft bg-ivory text-ink shadow-glass fixed bottom-24 left-1/2 z-[45] flex w-[calc(100vw-10rem)] max-w-xs min-w-52 -translate-x-1/2 items-center gap-3 rounded-2xl border px-4 py-3 transition duration-200 motion-reduce:transition-opacity md:top-24 md:right-4 md:bottom-auto md:left-auto md:w-72 md:max-w-none md:translate-x-0 ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-2 opacity-0 motion-reduce:translate-y-0'
      }`}
    >
      <span className="bg-accent-500 text-ivory flex size-6 shrink-0 items-center justify-center rounded-full">
        <Check className="size-3.5" aria-hidden="true" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">
          {detail.kind === 'deal' ? 'Deal added' : 'Service added'}
        </p>
        <p className="font-display text-ink-muted truncate text-xs">{detail.name}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          setShown(false);
          window.dispatchEvent(new Event(OPEN_CART_EVENT));
        }}
        className="text-accent-700 focus-visible:ring-accent-500 shrink-0 rounded-md px-1 text-xs font-semibold underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none"
      >
        View cart
      </button>
    </div>
  );
}
