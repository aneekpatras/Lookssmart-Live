import { Link } from '@inertiajs/react';
import { MessageCircle, Search } from 'lucide-react';
import * as React from 'react';

import { type FaqItem, FaqAccordion, useOpenSet } from '@/Components/FaqAccordion';
import { SeoHead } from '@/Components/SeoHead';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import PublicLayout from '@/Layouts/PublicLayout';

interface FaqCategory {
  id: string;
  label: string;
}

interface FaqsPageProps {
  categories: FaqCategory[];
  items: FaqItem[];
  whatsapp: { display_phone: string; chat_url: string };
}

function pillClass(active: boolean): string {
  return `shrink-0 rounded-full border px-3 py-1.5 text-xs whitespace-nowrap sm:px-4 sm:py-2 sm:text-sm ${
    active
      ? 'border-ink bg-ink text-ivory'
      : 'border-border-soft text-ink-muted hover:border-accent-500'
  }`;
}

const WHATSAPP_BUTTON =
  'inline-flex items-center justify-center gap-2 rounded-md bg-[#25D366] px-5 py-3 text-sm font-semibold text-white transition-colors hover:bg-[#1DA851] focus-visible:ring-2 focus-visible:ring-[#25D366] focus-visible:ring-offset-2 focus-visible:outline-none';

export default function Faqs({ categories, items, whatsapp }: FaqsPageProps) {
  const [category, setCategory] = React.useState<string | null>(null);
  const [search, setSearch] = React.useState('');
  const { openIds, toggle, open } = useOpenSet(items[0] ? [items[0].id] : []);

  // #faq-<id>: open that question and scroll to it.
  React.useEffect(() => {
    const match = window.location.hash.match(/^#faq-(\d+)$/);
    if (!match) return;
    const id = Number(match[1]);
    if (!items.some((item) => item.id === id)) return;
    open(id);
    const timer = window.setTimeout(() => {
      document.getElementById(`faq-${id}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
    return () => window.clearTimeout(timer);
  }, [items, open]);

  const visible = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    return items.filter(
      (item) =>
        (!category || item.category === category) &&
        (!query ||
          item.question.toLowerCase().includes(query) ||
          item.answer.toLowerCase().includes(query)),
    );
  }, [items, category, search]);

  return (
    <>
      <SeoHead
        title="FAQs: Booking, Prices and Visiting"
        description="Answers about booking, walk-ins, prices, payment, bridal bookings and visiting Looks Smart, a women-only salon in Central Park, Lahore."
      />

      <section className="bg-ivory border-border-soft border-b px-6 py-14 lg:px-10 lg:py-20">
        <div className="mx-auto max-w-3xl">
          <p className="text-accent-700 text-xs font-semibold tracking-[0.22em] uppercase">
            Help and answers
          </p>
          <h1 className="font-display text-ink mt-4 text-4xl font-medium sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="text-ink-muted mt-4 max-w-xl">
            Everything you need to know about booking, prices, payment and visiting Looks Smart in
            Lahore.
          </p>
        </div>
      </section>

      <section className="px-6 py-10 lg:px-10 lg:py-14">
        <div className="mx-auto max-w-3xl">
          <div className="relative w-full">
            <Search
              className="text-ink-muted absolute top-1/2 left-3 size-4 -translate-y-1/2"
              aria-hidden="true"
            />
            <Input
              aria-label="Search questions"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search questions"
              className="pl-9"
            />
          </div>

          <div
            role="group"
            aria-label="Filter questions by category"
            className="no-scrollbar -mx-1 mt-4 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
          >
            <button
              type="button"
              aria-pressed={category === null}
              onClick={() => setCategory(null)}
              className={pillClass(category === null)}
            >
              All
            </button>
            {categories.map((entry) => (
              <button
                key={entry.id}
                type="button"
                aria-pressed={category === entry.id}
                onClick={() => setCategory(entry.id)}
                className={pillClass(category === entry.id)}
              >
                {entry.label}
              </button>
            ))}
          </div>

          <div className="mt-8">
            {visible.length > 0 ? (
              <FaqAccordion items={visible} openIds={openIds} onToggle={toggle} />
            ) : (
              <div className="py-12 text-center">
                <p className="text-ink-muted">
                  No questions match your search. Message us on WhatsApp and we will help.
                </p>
                <a
                  href={whatsapp.chat_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={`${WHATSAPP_BUTTON} mt-5`}
                >
                  <MessageCircle className="size-4" aria-hidden="true" /> Message on WhatsApp
                </a>
              </div>
            )}
          </div>

          <div className="border-border-soft bg-surface shadow-soft mt-12 rounded-2xl border p-6 text-center sm:p-8">
            <h2 className="font-display text-ink text-2xl font-medium">Still have a question?</h2>
            <p className="text-ink-muted mt-2">
              Message us on WhatsApp and we will get back to you.
            </p>
            <div className="mt-5 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <a
                href={whatsapp.chat_url}
                target="_blank"
                rel="noopener noreferrer"
                className={WHATSAPP_BUTTON}
              >
                <MessageCircle className="size-4" aria-hidden="true" /> Message on WhatsApp
              </a>
              <Button asChild variant="outline" size="lg">
                <Link href="/book">Book now</Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

Faqs.layout = (page: React.ReactNode) => <PublicLayout solidHeader>{page}</PublicLayout>;
