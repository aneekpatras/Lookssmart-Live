import { useCallback, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link, router } from '@inertiajs/react';
import { X, ChevronLeft, ChevronRight, Check, CalendarCheck } from 'lucide-react';

import { toast } from 'sonner';

import { Button } from '@/Components/ui/button';
import { addToCart, CART_CHANGED_EVENT, cartBookingUrl, getCartItems } from '@/lib/cart';
import { formatCurrency } from '@/lib/currency';
import { dealTiming, formatDuration } from '@/lib/format';

interface Image {
  id: number;
  image_path: string;
  caption?: string | null;
  specialty?: string | null;
  category?: string | null;
  link?: ImageLink | null;
}

type BundledService = { id: number; name: string; price: string; image_url: string | null };

export interface ImageLink {
  type: 'service' | 'deal';
  id: number;
  name: string;
  price?: string | null;
  duration_min?: number | null;
  original_price?: string | null;
  savings_percent?: number | null;
  ends_at?: string | null;
  included_count?: number;
  service?: BundledService;
  deal?: { bundled_services: BundledService[]; original_price: string | null; deal_price: string | null };
}

interface LightboxProps {
  images: Image[];
  initialIndex: number;
  isOpen: boolean;
  onClose: () => void;
}

const FOCUSABLE_SELECTOR = 'a[href], button:not([disabled]), [tabindex]:not([tabindex="-1"])';

export function Lightbox({ images, initialIndex, isOpen, onClose }: LightboxProps) {
  const [currentIndex, setCurrentIndex] = useState(initialIndex);
  const previousInitialIndexRef = useRef(initialIndex);
  const dialogRef = useRef<HTMLDivElement>(null);
  const previouslyFocusedRef = useRef<HTMLElement | null>(null);
  const [addedId, setAddedId] = useState<number | null>(null);
  const [, setCartTick] = useState(0);

  // Re-render when the cart changes so the Add to Cart button always reflects it.
  useEffect(() => {
    const bump = () => setCartTick((tick) => tick + 1);
    window.addEventListener(CART_CHANGED_EVENT, bump);
    return () => window.removeEventListener(CART_CHANGED_EVENT, bump);
  }, []);

  useEffect(() => {
    if (previousInitialIndexRef.current !== initialIndex) {
      setCurrentIndex(initialIndex);
      previousInitialIndexRef.current = initialIndex;
    }
  }, [initialIndex]);

  const goToPrevious = useCallback(() => {
    setCurrentIndex((prev) => (prev === 0 ? images.length - 1 : prev - 1));
  }, [images.length]);

  const goToNext = useCallback(() => {
    setCurrentIndex((prev) => (prev === images.length - 1 ? 0 : prev + 1));
  }, [images.length]);

  // Focus management: move focus into the dialog on open (there is otherwise nothing keyboard-
  // reachable inside it until the user tabs from wherever focus happened to already be), and give it
  // back to whatever triggered the lightbox on close — a real focus trap, not just Escape-to-close.
  useEffect(() => {
    if (isOpen) {
      previouslyFocusedRef.current = document.activeElement as HTMLElement | null;
      dialogRef.current?.focus();
    } else {
      previouslyFocusedRef.current?.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
        return;
      }

      if (e.key === 'ArrowLeft') {
        goToPrevious();
        return;
      }

      if (e.key === 'ArrowRight') {
        goToNext();
        return;
      }

      if (e.key === 'Tab' && dialogRef.current) {
        const focusable = Array.from(dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
        if (focusable.length === 0) return;

        const first = focusable[0]!;
        const last = focusable[focusable.length - 1]!;

        if (e.shiftKey && document.activeElement === first) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose, goToPrevious, goToNext]);

  if (images.length === 0) return null;

  const currentImage = images[currentIndex]!;
  const link = currentImage.link ?? null;
  const detailText = link ? link.name : currentImage.specialty || currentImage.caption || null;
  const subText = link ? currentImage.specialty || null : null;

  /** True once everything this photo's link would add is already in the cart. */
  function linkInCart(): boolean {
    if (!link) return false;
    const inCart = getCartItems();
    if (link.type === 'service' && link.service) {
      return inCart.some((item) => item.id === link.service!.id);
    }
    const bundled = link.deal?.bundled_services ?? [];
    return bundled.length > 0 && bundled.every((svc) => inCart.some((item) => item.id === svc.id));
  }

  /** Adds the linked service/deal with the shared cart logic (never twice). */
  function addLinkToCart() {
    if (!link || linkInCart()) return;
    if (link.type === 'service' && link.service) {
      addToCart({ kind: 'service', label: link.name, service: link.service }, toast);
    } else if (link.deal) {
      addToCart(
        {
          kind: 'deal',
          dealId: link.id,
          label: link.name,
          bundledServices: link.deal.bundled_services,
          originalPrice: link.deal.original_price,
          dealPrice: link.deal.deal_price,
        },
        toast,
      );
    }
    setAddedId(currentImage.id);
  }

  function bookThisLook() {
    addLinkToCart();
    // The add above is already written to storage (synchronously); now go straight to booking.
    onClose();
    router.visit(cartBookingUrl());
  }

  const inCartNow = linkInCart();
  const justAdded = inCartNow && addedId === currentImage.id;

  return (
    <AnimatePresence>
      {isOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.2 }}
          onClick={onClose}
          className="fixed inset-0 z-50 bg-black/90 flex items-center justify-center p-4 outline-none"
          role="dialog"
          aria-label="Image lightbox"
          aria-modal="true"
          ref={dialogRef}
          tabIndex={-1}
        >
          <motion.div
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.95, opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={(e) => e.stopPropagation()}
            className="bg-ivory relative flex max-h-[94dvh] w-full max-w-3xl flex-col overflow-x-hidden overflow-y-auto rounded-2xl shadow-2xl"
          >
            {/* Photo, with the arrows laid over its edges */}
            <div className="relative flex h-[50dvh] shrink-0 items-center justify-center overflow-hidden bg-black sm:h-[60dvh] lg:h-[64dvh]">
              <motion.img
                key={currentImage.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                src={currentImage.image_path}
                alt={currentImage.caption || `Image ${currentIndex + 1}`}
                className="h-auto max-h-full w-auto max-w-full object-contain"
              />
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="focus-visible:ring-accent-500 absolute top-3 right-3 z-10 flex size-10 items-center justify-center rounded-full bg-black/60 text-white shadow-md ring-1 ring-white/30 transition-colors hover:bg-black/80 focus-visible:ring-2 focus-visible:outline-none"
              >
                <X size={20} aria-hidden="true" />
              </button>
              <div className="absolute top-3 left-3 rounded-full bg-black/70 px-3 py-1 text-xs font-medium text-white shadow-md ring-1 ring-white/20">
                {currentIndex + 1} / {images.length}
              </div>
              {images.length > 1 && (
                <>
                  <button
                    onClick={goToPrevious}
                    className="absolute top-1/2 left-2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition-colors hover:bg-black/70"
                    aria-label="Previous image"
                  >
                    <ChevronLeft size={24} />
                  </button>
                  <button
                    onClick={goToNext}
                    className="absolute top-1/2 right-2 -translate-y-1/2 rounded-full bg-black/45 p-2 text-white transition-colors hover:bg-black/70"
                    aria-label="Next image"
                  >
                    <ChevronRight size={24} />
                  </button>
                </>
              )}
            </div>

            {/* Details: specialty (else caption), category chip, actions */}
            <div className="space-y-4 p-5 sm:p-6">
              {(detailText || currentImage.category) && (
                <div>
                  {currentImage.category && (
                    <span className="border-accent-500/40 bg-accent-500/10 text-accent-700 inline-flex rounded-full border px-3 py-1 text-xs font-semibold">
                      {currentImage.category}
                    </span>
                  )}
                  <div className="mt-2 flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                    {detailText && (
                      <p className="font-display text-ink min-w-0 text-xl leading-snug font-medium break-words">
                        {detailText}
                      </p>
                    )}
                    {link && link.price && (
                      <div className="shrink-0 sm:text-right">
                        {link.type === 'deal' ? (
                          <>
                            <p className="flex flex-wrap items-baseline gap-x-2 sm:justify-end">
                              <span className="font-display text-ink text-lg font-medium">
                                {formatCurrency(link.price)}
                              </span>
                              {link.original_price && (
                                <span className="text-ink-muted text-xs line-through">
                                  {formatCurrency(link.original_price)}
                                </span>
                              )}
                              {!!link.savings_percent && link.savings_percent > 0 && (
                                <span className="bg-accent-500 text-ivory rounded-full px-2 py-0.5 text-xs font-semibold whitespace-nowrap">
                                  {link.savings_percent}% OFF
                                </span>
                              )}
                            </p>
                            {dealTiming(link.ends_at ?? null, link.included_count ?? 0) && (
                              <p className="text-ink-muted text-xs">
                                {dealTiming(link.ends_at ?? null, link.included_count ?? 0)}
                              </p>
                            )}
                          </>
                        ) : (
                          <p className="text-accent-700 text-sm font-semibold">
                            {formatCurrency(link.price)}
                            {link.duration_min ? ` · ${formatDuration(link.duration_min)}` : ''}
                          </p>
                        )}
                      </div>
                    )}
                  </div>
                  {subText && <p className="text-ink-muted mt-1 text-sm">{subText}</p>}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                {link ? (
                  <>
                    <Button
                      type="button"
                      variant="accent"
                      size="lg"
                      className="sm:flex-1"
                      onClick={addLinkToCart}
                      disabled={inCartNow}
                    >
                      {justAdded ? (
                        <>
                          <Check aria-hidden="true" /> Added
                        </>
                      ) : inCartNow ? (
                        <>
                          <Check aria-hidden="true" /> In cart
                        </>
                      ) : (
                        'Add to Cart'
                      )}
                    </Button>
                    <Button type="button" variant="outline" size="lg" className="sm:flex-1" onClick={bookThisLook}>
                      <CalendarCheck className="size-4" aria-hidden="true" /> Book this service
                    </Button>
                  </>
                ) : (
                  <Button asChild variant="accent" size="lg" className="w-full">
                    <Link href={`/book?look=${currentImage.id}`} onClick={onClose}>
                      <CalendarCheck className="size-4" aria-hidden="true" /> Book now
                    </Link>
                  </Button>
                )}
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
