import { Link } from '@inertiajs/react';
import { ArrowRight, Check, Plus, Sparkles } from 'lucide-react';

import { CartAddButton } from '@/Components/CartAddButton';
import { Button } from '@/Components/ui/button';
import { Card, CardContent } from '@/Components/ui/card';
import { claimDealInCart } from '@/lib/cart';
import { formatCurrency } from '@/lib/currency';

import type { DealShowcase } from './DealDetailsModal';

interface DealCardProps {
  deal: DealShowcase;
  onViewDetails: (deal: DealShowcase) => void;
}

/**
 * A single deal card: image header, category tag + title, included-services checklist, a price
 * breakdown box (strikethrough original, bold deal price, savings badge), and three actions —
 * Claim Offer (primary, goes straight into the booking flow), Details (secondary, opens the
 * `DealDetailsModal`), and a WhatsApp quick link. Deliberately no add-to-cart control — the spec
 * calls for direct-to-booking CTAs only, not a cart step.
 */
export function DealCard({ deal, onViewDetails }: DealCardProps) {
  const previewServices = deal.included_services.slice(0, 4);
  const remainingCount = deal.included_services.length - previewServices.length;

  return (
    <Card
      data-carousel-item
      className="border-border-soft bg-surface shadow-soft flex w-full flex-col overflow-hidden"
    >
      <div className="bg-accent-50 relative h-32 shrink-0 sm:h-48">
        {deal.image_url ? (
          <img
            src={deal.image_url}
            alt={deal.title}
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div className="text-accent-700 flex size-full items-center justify-center">
            <Sparkles className="size-8" aria-hidden="true" />
          </div>
        )}
        {deal.is_top_deal && (
          <span className="bg-ink text-ivory absolute top-3 left-3 rounded-full px-3 py-1 text-xs font-semibold tracking-wider uppercase">
            Top Deal
          </span>
        )}
      </div>

      <CardContent className="flex flex-1 flex-col p-3 sm:p-4">
        {deal.category_tag && (
          <p className="text-accent-700 text-xs font-semibold tracking-wider uppercase">
            {deal.category_tag}
          </p>
        )}
        <h3 className="font-display mt-1 text-base leading-snug font-medium sm:mt-1.5 sm:text-lg">
          {deal.title}
        </h3>
        {deal.subtitle && (
          <p className="text-ink-muted mt-1 line-clamp-1 text-sm sm:line-clamp-none">
            {deal.subtitle}
          </p>
        )}

        {previewServices.length > 0 && (
          <ul className="mt-2 space-y-0.5 sm:mt-3 sm:space-y-1">
            {previewServices.map((item, index) => (
              // Mobile shows the first 2 only; the rest (and "+N more") fold into one count.
              <li
                key={item}
                className={`text-ink-muted gap-2 text-sm leading-6 ${index >= 2 ? 'hidden sm:flex' : 'flex'}`}
              >
                <Check className="text-accent-600 mt-0.5 size-4 shrink-0" aria-hidden="true" />
                <span className="truncate">{item}</span>
              </li>
            ))}
            {remainingCount > 0 && (
              <li className="text-ink-muted hidden pl-6 text-xs sm:block">
                +{remainingCount} more included
              </li>
            )}
            {deal.included_services.length > 2 && (
              <li className="text-ink-muted pl-6 text-xs sm:hidden">
                +{deal.included_services.length - 2} more included
              </li>
            )}
          </ul>
        )}

        {deal.deal_price && (
          <div className="border-border-soft bg-ivory mt-3 rounded-lg border p-2.5 sm:mt-4 sm:p-3">
            <div className="flex items-end justify-between gap-3">
              <div>
                {deal.original_price && (
                  <p className="text-ink-muted text-xs line-through">
                    {formatCurrency(deal.original_price)}
                  </p>
                )}
                <p className="text-ink font-display text-lg font-medium whitespace-nowrap sm:text-xl">
                  {formatCurrency(deal.deal_price)}
                </p>
              </div>
              {deal.savings_percent !== null && deal.savings_percent > 0 && (
                <span className="bg-accent-500 text-ivory shrink-0 rounded-full px-2.5 py-1 text-xs font-semibold whitespace-nowrap">
                  {deal.savings_percent}% OFF
                </span>
              )}
            </div>
          </div>
        )}

        <div className="mt-3 grid grid-cols-2 gap-2 sm:mt-4">
          <Button asChild variant="accent" size="sm" className="col-span-2">
            {/* `prefetch` (ad hoc task 31) loads /book in the background on hover, so by the time a
                real click lands the response is often already cached — the click itself then just
                swaps in an already-fetched page instead of waiting on a fresh round trip. */}
            <Link href={deal.claim_url} prefetch onClick={() => claimDealInCart(deal)}>
              Claim Offer <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
          <Button variant="outline" size="sm" onClick={() => onViewDetails(deal)}>
            Details
          </Button>
          <CartAddButton
            variant="outline"
            size="sm"
            input={{
              kind: 'deal',
              dealId: deal.id,
              label: deal.title,
              bundledServices: deal.bundled_services,
              originalPrice: deal.original_price,
              dealPrice: deal.deal_price,
            }}
          >
            <Plus className="size-4" aria-hidden="true" />
            <span>
              Add<span className="hidden sm:inline"> to Cart</span>
            </span>
          </CartAddButton>
        </div>
      </CardContent>
    </Card>
  );
}
