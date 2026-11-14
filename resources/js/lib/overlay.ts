import * as React from 'react';

/**
 * Tiny shared flag for "a full-screen overlay is open" (the cart drawer, the mobile menu). The popup and
 * the sticky mobile bar read it so they stay out of the way. No library, no context provider needed.
 */
type OverlayName = 'cart' | 'menu';

const open: Record<OverlayName, boolean> = { cart: false, menu: false };
const listeners = new Set<() => void>();

export function setOverlayOpen(name: OverlayName, value: boolean): void {
  if (open[name] === value) return;
  open[name] = value;
  listeners.forEach((listener) => listener());
}

function anyOpen(): boolean {
  return open.cart || open.menu;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function useOverlayOpen(): boolean {
  return React.useSyncExternalStore(subscribe, anyOpen, () => false);
}

/** Registers one overlay's open state for as long as the component is mounted. */
export function useRegisterOverlay(name: OverlayName, value: boolean): void {
  React.useEffect(() => {
    setOverlayOpen(name, value);
    return () => setOverlayOpen(name, false);
  }, [name, value]);
}

/** Pages where floating promos (WhatsApp popup, sticky bar) never appear. */
export function isQuietPage(url: string, component: string): boolean {
  const path = url.split('?')[0] ?? url;
  return (
    path.startsWith('/book') ||
    path.startsWith('/admin') ||
    /^\/(login|register|forgot-password|reset-password|two-factor|confirm-password|verify-email)/.test(path) ||
    component.startsWith('Auth/') ||
    component.startsWith('Errors/') ||
    component.startsWith('Admin/')
  );
}
