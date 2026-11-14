import { useCallback, useEffect, useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Link } from '@inertiajs/react';
import { X, ChevronLeft, ChevronRight } from 'lucide-react';

import { toast } from 'sonner';

import { Button } from '@/Components/ui/button';
import { addToCart, getCartItems, OPEN_CART_EVENT } from '@/lib/cart';

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

  function bookThisLook() {
    if (!link) return;
    const inCart = getCartItems();
    if (link.type === 'service' && link.service) {
      if (!inCart.some((item) => item.id === link.service!.id)) {
        addToCart({ kind: 'service', label: link.name, service: link.service }, toast);
      }
    } else if (link.deal) {
      const bundled = link.deal.bundled_services;
      if (!bundled.every((svc) => inCart.some((item) => item.id === svc.id))) {
        addToCart(
          {
            kind: 'deal',
            dealId: link.id,
            label: link.name,
            bundledServices: bundled,
            originalPrice: link.deal.original_price,
            dealPrice: link.deal.deal_price,
          },
          toast,
        );
      }
    }
    onClose();
    window.setTimeout(() => window.dispatchEvent(new Event(OPEN_CART_EVENT)), 50);
  }

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
            className="bg-ivory relative flex max-h-[94vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl shadow-2xl"
          >
            {/* Photo, with the arrows laid over its edges */}
            <div className="relative flex max-h-[60vh] min-h-0 flex-1 items-center justify-center bg-black">
              <motion.img
                key={currentImage.id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 0.3 }}
                src={currentImage.image_path}
                alt={currentImage.caption || `Image ${currentIndex + 1}`}
                className="max-h-[60vh] w-full object-contain"
              />
              <div className="absolute top-3 left-3 rounded-full bg-black/55 px-3 py-1 text-xs text-white">
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
                  {detailText && (
                    <p className="font-display text-ink mt-2 text-xl leading-snug font-medium">
                      {detailText}
                    </p>
                  )}
                  {subText && <p className="text-ink-muted mt-1 text-sm">{subText}</p>}
                </div>
              )}
              <div className="flex flex-col gap-3 sm:flex-row">
                {link ? (
                  <Button type="button" variant="accent" size="lg" className="sm:flex-1" onClick={bookThisLook}>
                    Book this look
                  </Button>
                ) : (
                  <Button asChild variant="accent" size="lg" className="sm:flex-1">
                    <Link href={`/book?look=${currentImage.id}`} onClick={onClose}>
                      Book this look
                    </Link>
                  </Button>
                )}
                <Button type="button" variant="outline" size="lg" onClick={onClose} className="sm:flex-1">
                  <X aria-hidden="true" /> Close
                </Button>
              </div>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
