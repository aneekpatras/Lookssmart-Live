import { Link } from '@inertiajs/react';
import { CalendarCheck, MessageCircle, Search } from 'lucide-react';
import * as React from 'react';

import { type FaqItem, FaqAccordion, useOpenSet } from '@/Components/FaqAccordion';
import { SeoHead } from '@/Components/SeoHead';
import { Button } from '@/Components/ui/button';
import { Input } from '@/Components/ui/input';
import PublicLayout from '@/Layouts/PublicLayout';
import { useHeaderHandoff } from '@/lib/useHeaderHandoff';
import { scrollToSection, useScrollSpy } from '@/lib/useScrollSpy';

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
  const [search, setSearch] = React.useState('');
  const [tagsRef, tagsStyle] = useHeaderHandoff();
  const { openIds, toggle, open } = useOpenSet(items[0] ? [items[0].id] : []);
  const searching = search.trim() !== '';

  // One section per category, in category order; empty ones are dropped.
  const sections = React.useMemo(
    () =>
      categories
        .map((category) => ({
          id: `faq-category-${category.id}`,
          name: category.label,
          items: items.filter((item) => item.category === category.id),
        }))
        .filter((section) => section.items.length > 0),
    [categories, items],
  );
  const sectionIds = React.useMemo(() => sections.map((section) => section.id), [sections]);

  const matches = React.useMemo(() => {
    const query = search.trim().toLowerCase();
    if (!query) return [];
    return items.filter(
      (item) =>
        item.question.toLowerCase().includes(query) || item.answer.toLowerCase().includes(query),
    );
  }, [items, search]);

  const spyId = useScrollSpy(searching ? [] : sectionIds, 190);
  const [pastTop, setPastTop] = React.useState(false);

  // "All" is the highlighted tag until the first section has been reached.
  React.useEffect(() => {
    if (searching || sectionIds.length === 0) return;
    function onScroll() {
      const first = document.getElementById(sectionIds[0]!);
      setPastTop(!!first && first.getBoundingClientRect().top <= 210);
    }
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [searching, sectionIds]);

  const activeId = searching ? null : pastTop ? spyId : null;

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

  // Clicking a tag during a search returns to the sections view, then scrolls there.
  const pendingScroll = React.useRef<string | null>(null);
  React.useEffect(() => {
    if (!searching && pendingScroll.current) {
      const id = pendingScroll.current;
      pendingScroll.current = null;
      window.setTimeout(() => scrollToSection(id), 50);
    }
  }, [searching]);

  function selectSection(id: string) {
    if (searching) {
      pendingScroll.current = id;
      setSearch('');
    } else {
      scrollToSection(id);
    }
  }

  return (
    <>
      <SeoHead
        title="FAQs: Booking, Prices and Visiting"
        description="Answers about booking, walk-ins, prices, payment, bridal bookings and visiting Looks Smart, a women-only salon in Central Park, Lahore."
      />

      <section className="bg-ivory border-border-soft border-b px-6 pt-14 pb-10 lg:px-10 lg:pt-20 lg:pb-11">
        <div className="mx-auto max-w-3xl">
          <p className="text-accent-700 text-sm font-semibold tracking-[0.22em] uppercase">
            Help and answers
          </p>
          <h1 className="font-display text-ink mt-4 text-4xl font-medium sm:text-5xl">
            Frequently asked questions
          </h1>
          <p className="text-ink-muted mt-4 max-w-xl text-base sm:text-lg">
            Everything you need to know about booking, prices, payment and visiting Looks Smart in
            Lahore.
          </p>
        </div>
      </section>

      <section className="px-6 pb-10 lg:px-10 lg:pb-14">
        <div className="mx-auto max-w-3xl">
          <div
            ref={tagsRef}
            className="sticky z-30 transition-[top] duration-300"
            style={tagsStyle}
          >
            <div className="border-border-soft bg-ivory -mx-1 flex min-w-0 flex-col gap-3 border-b px-1 py-3">
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
                aria-label="Jump to a question category"
                className="no-scrollbar -mx-1 flex min-w-0 gap-2 overflow-x-auto px-1 pb-1"
              >
                <button
                  type="button"
                  aria-pressed={!searching && activeId === null}
                  onClick={() => {
                    if (searching) setSearch('');
                    else window.scrollTo({ top: 0, behavior: 'smooth' });
                  }}
                  className={pillClass(!searching && activeId === null)}
                >
                  All
                </button>
                {sections.map((section) => (
                  <button
                    key={section.id}
                    type="button"
                    aria-pressed={activeId === section.id}
                    onClick={() => selectSection(section.id)}
                    className={pillClass(activeId === section.id)}
                  >
                    {section.name}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-8">
            {searching ? (
              matches.length > 0 ? (
                <FaqAccordion items={matches} openIds={openIds} onToggle={toggle} />
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
              )
            ) : (
              <div className="space-y-10">
                {sections.map((section) => (
                  <div key={section.id} id={section.id} className="scroll-mt-44">
                    <h2 className="font-display text-ink mb-3 text-2xl font-medium sm:text-3xl">
                      {section.name}
                    </h2>
                    <FaqAccordion items={section.items} openIds={openIds} onToggle={toggle} />
                  </div>
                ))}
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
                <Link href="/book">
                  <CalendarCheck className="size-4" aria-hidden="true" /> Book now
                </Link>
              </Button>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}

Faqs.layout = (page: React.ReactNode) => <PublicLayout solidHeader>{page}</PublicLayout>;
