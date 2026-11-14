import * as React from 'react';
import { Brush, Check, Clock3, Flower2, Plus, Scissors, Sparkles } from 'lucide-react';

import { formatCurrency } from '@/lib/currency';
import { formatDuration } from '@/lib/format';

interface BookItemCardProps {
  id: number;
  title: string;
  /** Small uppercase label above the title (category name, or "Deal"). */
  label: string | null;
  imageUrl: string | null;
  /** The price shown in the pill (a deal's discounted price). */
  price: string | null;
  /** A struck-through reference price (deals/packages only). */
  originalPrice?: string | null;
  durationMin?: number | null;
  selected: boolean;
  /** aria-label for the Add pill, e.g. "Facial: Add" / "Facial: Added" (kept stable for tests). */
  ariaLabel: string;
  onToggle: () => void;
}

const TINTS = ['bg-[#f3ece0]', 'bg-[#efe6d6]', 'bg-[#f6efe2]', 'bg-[#ece3d3]'];

/** Picks a lucide icon from the category label — purely decorative, no network request. */
function categoryIcon(label: string | null): React.ReactElement {
  const text = (label ?? '').toLowerCase();
  const props = { className: 'size-7 opacity-70', strokeWidth: 1.5 };
  if (/hair|cut|colour|color|style/.test(text)) return <Scissors {...props} />;
  if (/makeup|bridal|beauty/.test(text)) return <Brush {...props} />;
  if (/spa|nail|mani|pedi|massage/.test(text)) return <Flower2 {...props} />;
  return <Sparkles {...props} />;
}

/**
 * Compact vertical card for the booking page's "Select services" list (services and deals alike).
 * Only the Add pill toggles the selection, so scrolling on a phone never selects by accident.
 */
export function BookItemCard({
  id,
  title,
  label,
  imageUrl,
  price,
  originalPrice,
  durationMin,
  selected,
  ariaLabel,
  onToggle,
}: BookItemCardProps) {
  return (
    <div
      className={`flex min-w-0 flex-col overflow-hidden rounded-[14px] transition-colors ${
        selected
          ? 'border-accent-500 border-[1.5px] bg-[#fbf5e8]'
          : 'border-border-soft border-[0.5px] bg-white'
      }`}
    >
      <div className="relative h-[78px] shrink-0 overflow-hidden sm:h-24">
        {imageUrl ? (
          <img
            src={imageUrl}
            alt=""
            loading="lazy"
            decoding="async"
            className="size-full object-cover"
          />
        ) : (
          <div
            className={`${TINTS[id % TINTS.length]} text-accent-700 flex size-full items-center justify-center`}
            aria-hidden="true"
          >
            {categoryIcon(label)}
          </div>
        )}
        {price && (
          <span className="bg-ink text-ivory absolute bottom-1.5 left-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap">
            {formatCurrency(price)}
          </span>
        )}
        <button
          type="button"
          aria-pressed={selected}
          aria-label={ariaLabel}
          onClick={onToggle}
          className="group absolute top-0 right-0 flex h-10 items-center px-1.5 focus-visible:outline-none"
        >
          <span
            className={`group-focus-visible:ring-accent-700 flex h-7 items-center gap-1 rounded-full px-2.5 text-xs font-semibold whitespace-nowrap shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-offset-1 sm:h-[30px] ${
              selected ? 'bg-ink text-ivory' : 'bg-accent-500 text-white'
            }`}
          >
            {selected ? (
              <>
                <Check className="size-3.5" aria-hidden="true" /> Added
              </>
            ) : (
              <>
                <Plus className="size-3.5" aria-hidden="true" /> Add
              </>
            )}
          </span>
        </button>
      </div>
      <div className="flex flex-1 flex-col p-2.5">
        {label && (
          <span className="text-accent-700 truncate text-[11px] font-semibold tracking-wider uppercase">
            {label}
          </span>
        )}
        <strong className="font-display text-ink mt-0.5 line-clamp-2 min-h-[2.5em] text-[13px] leading-tight font-medium sm:text-sm">
          {title}
        </strong>
        <div className="text-ink-muted mt-1.5 flex items-center justify-between gap-2 text-xs">
          {durationMin ? (
            <span className="inline-flex items-center gap-1">
              <Clock3 className="size-3.5" aria-hidden="true" /> {formatDuration(durationMin)}
            </span>
          ) : (
            <span />
          )}
          {originalPrice && (
            <span className="text-[11px] line-through">{formatCurrency(originalPrice)}</span>
          )}
        </div>
      </div>
    </div>
  );
}
