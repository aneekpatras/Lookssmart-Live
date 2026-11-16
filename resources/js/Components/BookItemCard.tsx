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

const TINTS = ['bg-tint-a', 'bg-tint-b', 'bg-tint-c', 'bg-tint-d'];

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
          ? 'border-accent-500 border-[1.5px] bg-cream'
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
      </div>
      <div className="flex flex-1 flex-col p-2 sm:p-2.5">
        {label && (
          <span className="text-accent-700 truncate text-[11px] font-semibold tracking-wider uppercase">
            {label}
          </span>
        )}
        <strong className="font-display text-ink mt-0.5 line-clamp-2 min-h-[2.5em] text-[13px] leading-tight font-medium sm:text-sm">
          {title}
        </strong>
        <div className="mt-auto flex flex-wrap items-end justify-between gap-x-2 gap-y-1 pt-1.5">
          <div className="min-w-0">
            {durationMin ? (
              <span className="text-ink-muted flex items-center gap-1 text-xs">
                <Clock3 className="size-3.5 shrink-0" aria-hidden="true" />{' '}
                {formatDuration(durationMin)}
              </span>
            ) : null}
            {price && (
              <p className="text-ink mt-0.5 flex flex-wrap items-baseline gap-x-1.5 text-[13px] font-semibold whitespace-nowrap sm:text-sm">
                {formatCurrency(price)}
                {originalPrice && (
                  <span className="text-ink-muted text-[11px] font-normal line-through">
                    {formatCurrency(originalPrice)}
                  </span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            aria-pressed={selected}
            aria-label={ariaLabel}
            onClick={onToggle}
            className="group -my-[5px] ml-auto flex h-10 shrink-0 items-center focus-visible:outline-none"
          >
            <span
              className={`group-focus-visible:ring-accent-700 flex h-7 items-center gap-1 rounded-full px-2 text-xs font-semibold whitespace-nowrap shadow-sm group-focus-visible:ring-2 group-focus-visible:ring-offset-1 sm:h-[30px] sm:px-2.5 ${
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
      </div>
    </div>
  );
}
