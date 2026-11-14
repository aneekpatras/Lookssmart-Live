import { Link } from '@inertiajs/react';
import { ArrowRight } from 'lucide-react';

import { type FaqItem, FaqAccordion, useOpenSet } from '@/Components/FaqAccordion';
import { Button } from '@/Components/ui/button';

/** Small FAQ block for Home and Contact: five questions and a link to the full /faqs page. */
export function FaqPreview({ items }: { items: FaqItem[] }) {
  const { openIds, toggle } = useOpenSet();

  if (items.length === 0) return null;

  return (
    <section aria-labelledby="faq-preview-heading" className="px-6 py-14 sm:py-20 lg:px-10 lg:py-28">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <p className="text-accent-700 text-sm font-semibold tracking-[0.18em] uppercase">FAQs</p>
          <h2
            id="faq-preview-heading"
            className="font-display mt-3 text-3xl font-medium sm:text-5xl"
          >
            Questions? We have answers
          </h2>
          <p className="text-ink-muted mx-auto mt-3 max-w-xl text-base sm:mt-4 sm:text-lg">
            Quick answers about booking, prices and visiting.
          </p>
        </div>
        <div className="mt-8 sm:mt-10">
          <FaqAccordion items={items} openIds={openIds} onToggle={toggle} />
        </div>
        <div className="mt-8 text-center">
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
