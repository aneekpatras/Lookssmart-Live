import { Link } from '@inertiajs/react';
import { ArrowLeft, ArrowRight, Check, Clock3, MessageCircle, Plus, Sparkles } from 'lucide-react';
import * as React from 'react';

import type { DealShowcase } from '@/Components/DealDetailsModal';
import { SeoHead } from '@/Components/SeoHead';
import { CartAddButton } from '@/Components/CartAddButton';
import { Button } from '@/Components/ui/button';
import PublicLayout from '@/Layouts/PublicLayout';
import { formatCurrency } from '@/lib/currency';

interface DealDetailProps {
  deal: DealShowcase & { code: string | null };
  whatsapp: { display_phone: string; chat_url: string };
}

function formatEnd(endsAt: string | null): string | null {
  if (!endsAt) return null;
  const date = new Date(endsAt);
  if (Number.isNaN(date.getTime()) || date.getTime() <= Date.now()) return null;
  return new Intl.DateTimeFormat('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
    timeZone: 'Asia/Karachi',
  }).format(date);
}

/** A single deal's own page: image, what is included, price, terms, and the same two actions as the cards. */
export default function DealDetail({ deal, whatsapp }: DealDetailProps) {
  const image = deal.image_url ?? deal.bundled_services.find((s) => s.image_url)?.image_url ?? null;
  const ends = formatEnd(deal.ends_at);

  return (
    <>
      <SeoHead title={deal.title} description={deal.subtitle ?? deal.description ?? undefined} />

      <section className="px-6 py-10 lg:px-10 lg:py-16">
        <div className="mx-auto max-w-6xl">
          <Link
            href="/deals"
            className="text-ink-muted hover:text-accent-700 focus-visible:ring-accent-500 inline-flex items-center gap-1.5 rounded text-sm focus-visible:ring-2 focus-visible:outline-none"
          >
            <ArrowLeft className="size-4" aria-hidden="true" /> All deals
          </Link>

          <div className="mt-6 grid gap-8 lg:grid-cols-12 lg:gap-14">
            <div className="lg:col-span-5">
              <div className="bg-accent-50 shadow-soft border-border-soft relative aspect-[3/4] overflow-hidden rounded-2xl border">
                {image ? (
                  <img
                    src={image}
                    alt={deal.title}
                    className="size-full object-cover"
                    decoding="async"
                  />
                ) : (
                  <div className="bg-ink text-accent-300 flex size-full items-center justify-center">
                    <Sparkles className="size-12" aria-hidden="true" />
                  </div>
                )}
                {deal.savings_percent !== null && deal.savings_percent > 0 && (
                  <span className="bg-accent-500 text-ivory absolute top-4 left-4 rounded-full px-3 py-1 text-sm font-semibold shadow-sm">
                    {deal.savings_percent}% OFF
                  </span>
                )}
              </div>
            </div>

            <div className="lg:col-span-7">
              {deal.category_tag && (
                <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">
                  {deal.category_tag}
                </p>
              )}
              <h1 className="font-display mt-3 text-3xl leading-tight font-medium text-balance sm:text-4xl lg:text-5xl">
                {deal.title}
              </h1>
              {deal.subtitle && (
                <p className="text-ink-muted mt-3 text-lg leading-7">{deal.subtitle}</p>
              )}
              {ends && (
                <p className="text-ink-muted mt-3 flex items-center gap-2 text-sm">
                  <Clock3 className="size-4" aria-hidden="true" /> Offer valid until {ends}
                </p>
              )}

              {deal.description && (
                <p className="text-ink-muted mt-6 leading-7">{deal.description}</p>
              )}

              {deal.included_services.length > 0 && (
                <div className="mt-6">
                  <h2 className="font-display text-xl font-medium">What&rsquo;s included</h2>
                  <ul className="mt-3 space-y-2">
                    {deal.included_services.map((item) => (
                      <li key={item} className="text-ink-muted flex gap-2 leading-6">
                        <Check
                          className="text-accent-600 mt-1 size-4 shrink-0"
                          aria-hidden="true"
                        />
                        {item}
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {deal.deal_price && (
                <div className="border-border-soft bg-surface mt-6 flex flex-wrap items-end justify-between gap-4 rounded-xl border p-5">
                  <div>
                    {deal.original_price && (
                      <p className="text-ink-muted text-sm line-through">
                        {formatCurrency(deal.original_price)}
                      </p>
                    )}
                    <p className="font-display text-3xl font-medium">
                      {formatCurrency(deal.deal_price)}
                    </p>
                  </div>
                  {deal.code && (
                    <p className="border-accent-400 bg-accent-50 text-accent-700 rounded-full border px-3 py-1 text-xs font-semibold">
                      Code: {deal.code}
                    </p>
                  )}
                </div>
              )}

              <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <Button asChild variant="accent" size="lg">
                  <Link href={deal.claim_url}>
                    Claim Offer <ArrowRight aria-hidden="true" />
                  </Link>
                </Button>
                <CartAddButton
                  variant="outline"
                  size="lg"
                  checkClassName="size-5"
                  input={{
                    kind: 'deal',
                    dealId: deal.id,
                    label: deal.title,
                    bundledServices: deal.bundled_services,
                    originalPrice: deal.original_price,
                    dealPrice: deal.deal_price,
                  }}
                >
                  <Plus aria-hidden="true" /> Add to Cart
                </CartAddButton>
                <Button asChild variant="outline" size="lg">
                  <a href={whatsapp.chat_url} target="_blank" rel="noopener noreferrer">
                    <MessageCircle aria-hidden="true" /> Ask on WhatsApp
                  </a>
                </Button>
              </div>

              {deal.terms && (
                <div className="mt-8">
                  <h2 className="font-display text-lg font-medium">Terms &amp; conditions</h2>
                  <p className="text-ink-muted mt-2 text-sm leading-6">{deal.terms}</p>
                </div>
              )}
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

DealDetail.layout = (page: React.ReactNode) => <PublicLayout>{page}</PublicLayout>;
