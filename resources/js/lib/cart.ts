/**
 * Shared cart — the booking wizard's own service selection, persisted in `localStorage` (so it also
 * survives closing the tab and coming back, not just reload/back) so it
 * survives navigating between Home/Deals/Services and `/book` (ad hoc task 22), upgraded to carry
 * real display data per item (name/price/thumbnail) rather than bare ids (ad hoc task 24) so the
 * redesigned "Your Selection" sidebar and the header cart drawer can render a real line-item list
 * without an extra round trip. `window.dispatchEvent` on every write is what lets the header badge/
 * drawer — sibling components that never re-render on their own — react instantly to an add that
 * happened in a completely different part of the page.
 */
const CART_STORAGE_KEY = 'ls_booking_cart_items';
import { track } from '@/lib/track';
export const CART_CHANGED_EVENT = 'ls-cart-changed';
/** Dispatch to slide the header cart drawer open from anywhere (e.g. the gallery lightbox). */
export const OPEN_CART_EVENT = 'ls-open-cart';
/** Fired once per real add (never on removals, restores or already-in-cart no-ops) to show the popup. */
export const CART_ADDED_EVENT = 'ls-cart-added';
export interface CartAddedDetail {
  name: string;
  kind: 'service' | 'deal';
}

export function notifyCartAdded(name: string, kind: 'service' | 'deal'): void {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<CartAddedDetail>(CART_ADDED_EVENT, { detail: { name, kind } }),
  );
}

export interface CartItem {
  id: number;
  name: string;
  /** The actual (possibly deal-discounted) price this item contributes to the cart total. */
  price: string;
  /** Only set when this item came from a deal bundle and its price above is genuinely discounted
   * from this reference value — lets the drawer show a real strikethrough + "You Save" figure
   * without fabricating one for a plain, undiscounted service add (ad hoc task 25). */
  original_price?: string;
  image_url: string | null;
  /** Set only when this item came from a deal bundle — the deal's own id/title, so the cart drawer
   * can group every service the SAME deal added back into one visual "Deal" row (matching how the
   * item was actually added) instead of showing N separate service lines. The underlying storage
   * still keeps each real service id (booking needs those for duration/slot scheduling — grouping
   * only ever changes how the drawer DISPLAYS them, never what `/book` actually receives). */
  deal_id?: number;
  deal_label?: string;
}

/** A stored cart older than this is discarded, so abandoned items from an earlier visit can never
 * resurface as "random" services in a later booking. Refreshed on every write. */
const CART_TTL_MS = 24 * 60 * 60 * 1000;

/** Reads the stored cart items. Stored as `{ items, savedAt }`; a bare array (the pre-expiry format,
 * with no timestamp) or an expired payload counts as empty and is removed. */
function readRaw(): unknown {
  try {
    const stored = window.localStorage.getItem(CART_STORAGE_KEY);
    if (stored === null) return [];
    const payload = JSON.parse(stored) as { items?: unknown; savedAt?: unknown } | null;
    if (
      payload &&
      typeof payload === 'object' &&
      !Array.isArray(payload) &&
      typeof payload.savedAt === 'number' &&
      Date.now() - payload.savedAt < CART_TTL_MS
    ) {
      return payload.items;
    }
    window.localStorage.removeItem(CART_STORAGE_KEY);
  } catch {
    // storage blocked or corrupt: behave as an empty cart
  }
  return [];
}

export function getCartItems(): CartItem[] {
  if (typeof window === 'undefined') return [];
  try {
    const parsed = readRaw();
    if (!Array.isArray(parsed)) return [];
    return parsed.filter(
      (item): item is CartItem =>
        item &&
        typeof item === 'object' &&
        Number.isInteger(item.id) &&
        typeof item.name === 'string',
    );
  } catch {
    return [];
  }
}

export function getCartServiceIds(): number[] {
  return getCartItems().map((item) => item.id);
}

/** Replaces the whole cart (used by `Book.tsx`, which owns additions AND removals) and notifies
 * listeners — the header badge/drawer — that it changed. */
export function setCartItems(items: CartItem[]): void {
  const deduped = Array.from(new Map(items.map((item) => [item.id, item])).values());
  try {
    window.localStorage.setItem(
      CART_STORAGE_KEY,
      JSON.stringify({ items: deduped, savedAt: Date.now() }),
    );
  } catch {
    // storage blocked: the in-page event below still updates this tab
  }
  window.dispatchEvent(new Event(CART_CHANGED_EVENT));
}

/** Merges the given items into the cart (never removes an existing one) and notifies listeners.
 * Synchronous end to end (`getCartItems()` reads `sessionStorage` directly, no `await` in between
 * the read and the `setCartItems()` write) — a single JS task, so two "Add to Cart" clicks (even a
 * double-click firing both handlers back to back) can never interleave into a lost-update race; the
 * second call always reads the first call's already-written result. */
export function addItemsToCart(items: CartItem[]): void {
  if (items.length === 0) return;
  setCartItems([...getCartItems(), ...items]);
}

/**
 * Single, deterministic entry point every "Add to Cart" control on the site now shares (Services,
 * Home's service grid, Home's/Deals' deal cards) — ad hoc task 29 refactor. Before this, 4 call
 * sites each independently re-implemented "build cart item(s), call `addItemsToCart`, show a toast",
 * which worked correctly (verified live: no ID collisions, no duplicate/missing items under rapid
 * double-click and interleaved multi-add stress) but left 4 places that could silently drift out of
 * sync with each other over time. `kind: 'service'` always writes the service's OWN real id;
 * `kind: 'deal'` always writes its REAL bundled services' ids via `dealBundleToCartItems` — a deal's
 * own id is never a valid `CartItem.id` and is never referenced here, structurally closing off the
 * deal-id/service-id collision this was written to guard against.
 */
export type AddToCartInput =
  | {
      kind: 'service';
      label: string;
      service: { id: number; name: string; price: string; image_url: string | null };
    }
  | {
      kind: 'deal';
      dealId: number;
      label: string;
      bundledServices: { id: number; name: string; price: string; image_url: string | null }[];
      originalPrice: string | null;
      dealPrice: string | null;
    };

export function addToCart(
  input: AddToCartInput,
  toast: { success: (message: string) => void; error: (message: string) => void },
): void {
  if (input.kind === 'service') {
    addItemsToCart([
      {
        id: input.service.id,
        name: input.service.name,
        price: input.service.price,
        image_url: input.service.image_url,
      },
    ]);
    notifyCartAdded(input.service.name, 'service');
    track('add_to_cart', { kind: 'service', id: input.service.id });
    return;
  }

  if (input.bundledServices.length === 0) {
    toast.error('This deal has no bookable services attached yet.');
    return;
  }
  addItemsToCart(
    dealBundleToCartItems(
      input.bundledServices,
      input.originalPrice,
      input.dealPrice,
      input.dealId,
      input.label,
    ),
  );
  notifyCartAdded(input.label, 'deal');
  track('add_to_cart', { kind: 'deal', id: input.dealId });
}

/** True when the service is in the cart, or every service of the deal is (the gallery lightbox's rule). */
export function isInCart(input: AddToCartInput, items: CartItem[] = getCartItems()): boolean {
  if (input.kind === 'service') return items.some((item) => item.id === input.service.id);
  return (
    input.bundledServices.length > 0 &&
    input.bundledServices.every((svc) => items.some((item) => item.id === svc.id))
  );
}

/** Add button behaviour for every card: remove when already in the cart, otherwise add. */
export function toggleCart(input: AddToCartInput, toast: Parameters<typeof addToCart>[1]): void {
  if (!isInCart(input)) {
    addToCart(input, toast);
    return;
  }
  const ids =
    input.kind === 'service' ? [input.service.id] : input.bundledServices.map((svc) => svc.id);
  setCartItems(getCartItems().filter((item) => !ids.includes(item.id)));
}

export function removeFromCart(id: number): void {
  setCartItems(getCartItems().filter((item) => item.id !== id));
}

export function clearCart(): void {
  setCartItems([]);
}

/** `/book?service=1&service=2` from whatever is currently in the cart, or plain `/book` if empty. */
export function cartBookingUrl(): string {
  const ids = getCartServiceIds();
  return ids.length ? `/book?${ids.map((id) => `service=${id}`).join('&')}` : '/book';
}

/**
 * Turns a deal's real bundled services into cart items carrying an honest per-item discount —
 * each service's own catalog price becomes `original_price`, scaled down by the deal's real
 * `deal_price / original_price` ratio to produce `price`, so the sum of every item's `price` still
 * equals the deal's real advertised total (not just each item individually "looking" discounted).
 * Falls back to the plain, undiscounted service price when the deal has no real price breakdown to
 * scale from (`original_price`/`deal_price` are both optional on `Deal`).
 */
export function dealBundleToCartItems(
  bundledServices: { id: number; name: string; price: string; image_url: string | null }[],
  originalPrice: string | null,
  dealPrice: string | null,
  dealId: number,
  dealLabel: string,
): CartItem[] {
  const original = originalPrice ? Number(originalPrice) : null;
  const discounted = dealPrice ? Number(dealPrice) : null;
  const scale = original && original > 0 && discounted !== null ? discounted / original : null;

  return bundledServices.map((service) => ({
    id: service.id,
    name: service.name,
    price: scale !== null ? (Number(service.price) * scale).toFixed(2) : service.price,
    original_price: scale !== null ? service.price : undefined,
    image_url: service.image_url,
    deal_id: dealId,
    deal_label: dealLabel,
  }));
}

/** One visible cart line: a whole deal (all its services together) or a single service. */
export interface CartRow {
  key: string;
  name: string;
  price: number;
  /** Set only when the row's real catalog total is higher than `price` (a genuine deal saving). */
  original_price?: number;
  image_url: string | null;
  /** Every real service id behind this row (a deal row holds several). */
  ids: number[];
}

/**
 * The single place that turns `ls_booking_cart_items` into display lines. Both the header drawer and
 * the booking page's "Your selection" render exactly this, so their grouping, prices and counts can
 * never drift. Every item of the same deal collapses into one row; a plain service is its own row.
 */
export function groupCartRows(items: CartItem[]): CartRow[] {
  const groups = new Map<string, CartRow & { hasDiscount: boolean; originalSum: number }>();

  for (const item of items) {
    const key = item.deal_id ? `deal-${item.deal_id}` : `item-${item.id}`;
    const itemOriginal =
      item.original_price !== undefined ? Number(item.original_price) : Number(item.price);
    const existing = groups.get(key);

    if (existing) {
      existing.price += Number(item.price);
      existing.originalSum += itemOriginal;
      existing.hasDiscount = existing.hasDiscount || item.original_price !== undefined;
      existing.ids.push(item.id);
      continue;
    }

    groups.set(key, {
      key,
      name: item.deal_label ?? item.name,
      price: Number(item.price),
      image_url: item.image_url,
      ids: [item.id],
      hasDiscount: item.original_price !== undefined,
      originalSum: itemOriginal,
    });
  }

  return Array.from(groups.values()).map(({ hasDiscount, originalSum, ...row }) => ({
    ...row,
    original_price: hasDiscount ? originalSum : undefined,
  }));
}

/**
 * Called by every "Claim Offer" link BEFORE it navigates: this deal's services (with deal id/label and
 * discounted prices) are merged into the cart — existing items stay, a service already there is
 * updated rather than duplicated — so the header badge/drawer are already right when `/book` opens.
 * `/book` resolves the same deal from `?code=` and merges the same items (idempotent).
 */
export function claimDealInCart(deal: {
  id: number;
  title: string;
  original_price: string | null;
  deal_price: string | null;
  bundled_services: { id: number; name: string; price: string; image_url: string | null }[];
}): void {
  if (deal.bundled_services.length === 0) return;
  addItemsToCart(
    dealBundleToCartItems(
      deal.bundled_services,
      deal.original_price,
      deal.deal_price,
      deal.id,
      deal.title,
    ),
  );
}

/** "Book this service" links: the service is in the cart before `/book` opens. */
export function addServiceToCartForBooking(service: {
  id: number;
  name: string;
  price: string;
  image_url: string | null;
}): void {
  if (getCartItems().some((item) => item.id === service.id)) return;
  addItemsToCart([
    { id: service.id, name: service.name, price: service.price, image_url: service.image_url },
  ]);
}
