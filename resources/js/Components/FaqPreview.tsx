import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';

import { type FaqItem, FaqAccordion, useOpenSet } from '@/Components/FaqAccordion';
import { Button } from '@/Components/ui/button';

/** Small FAQ block for Home and Contact: five questions and a link to the full /faqs page. */
export function FaqPreview({ items }: { items: FaqItem[] }) {
  const { openIds, toggle } = useOpenSet();

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="faq-preview-heading" className="px-6 py-14 lg:px-10 lg:py-16">
      <div className="mx-auto max-w-3xl">
        <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">FAQs</p>
        <h2
          id="faq-preview-heading"
          className="font-display text-ink mt-2 text-3xl font-medium sm:text-4xl"
        >
          Questions? We have answers
        </h2>
        <div className="mt-8">
          <FaqAccordion items={items} openIds={openIds} onToggle={toggle} />
        </div>
        <div className="mt-8">
          <Button asChild variant="outline" size="lg">
            <Link href="/faqs">
              View all FAQs <ArrowRight aria-hidden="true" />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
