import { usePage } from '@inertiajs/react';
import * as React from 'react';

import { CART_CHANGED_EVENT, getCartItems } from '@/lib/cart';
import { syncCartSnapshot, trackPageView, trackSessionStart } from '@/lib/track';

/**
 * Anonymous visit tracking for the public site (renders nothing): one session_start per browser session,
 * a page view on every navigation, and the current cart whenever it changes. Same Do Not Track rule and
 * whitelist as the rest of lib/track.ts; no keystrokes, no field values.
 */
export function VisitorTracker() {
  const { url } = usePage();

  React.useEffect(() => {
    trackSessionStart();
    // A cart that already exists when the session starts is sent once.
    if (getCartItems().length > 0) sendCart();
  }, []);

  React.useEffect(() => {
    trackPageView();
  }, [url]);

  React.useEffect(() => {
    let timer: number | undefined;
    const onChange = () => {
      window.clearTimeout(timer);
      timer = window.setTimeout(sendCart, 1000);
    };
    window.addEventListener(CART_CHANGED_EVENT, onChange);
    return () => {
      window.removeEventListener(CART_CHANGED_EVENT, onChange);
      window.clearTimeout(timer);
    };
  }, []);

  return null;
}

function sendCart(): void {
  syncCartSnapshot(
    getCartItems().map((item) => ({
      id: item.id,
      name: item.name,
      type: item.deal_id ? 'deal' : 'service',
      price: Number(item.price) || 0,
    })),
  );
}
