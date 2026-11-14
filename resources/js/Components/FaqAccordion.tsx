import { Link } from '@inertiajs/react';
import { ChevronDown } from 'lucide-react';
import * as React from 'react';

export interface FaqItem {
  id: number;
  category: string;
  question: string;
  answer: string;
  links: { label: string; href: string; external: boolean }[];
}

interface FaqAccordionProps {
  items: FaqItem[];
  openIds: Set<number>;
  onToggle: (id: number) => void;
}

const linkClass =
  'text-accent-700 hover:text-accent-600 focus-visible:ring-accent-500 rounded-sm text-sm font-semibold underline-offset-2 hover:underline focus-visible:ring-2 focus-visible:outline-none';

/**
 * Accessible accordion: a real button per question (aria-expanded / aria-controls), only one item is
 * open at a time, and the answer height animates with a CSS grid-rows transition that is switched off for
 * prefers-reduced-motion. Shared by the /faqs page and the small FAQ block on Home and Contact.
 */
export function FaqAccordion({ items, openIds, onToggle }: FaqAccordionProps) {
  return (
    <ul className="space-y-3">
      {items.map((item) => {
        const open = openIds.has(item.id);
        const panelId = `faq-panel-${item.id}`;
        return (
          <li
            key={item.id}
            id={`faq-${item.id}`}
            className="border-border-soft scroll-mt-32 overflow-hidden rounded-2xl border bg-white"
          >
            <h3>
              <button
                type="button"
                aria-expanded={open}
                aria-controls={panelId}
                onClick={() => onToggle(item.id)}
                className="focus-visible:ring-accent-500 flex w-full items-center justify-between gap-4 px-4 py-4 text-left focus-visible:ring-2 focus-visible:outline-none focus-visible:ring-inset sm:px-5"
              >
                <span className="font-display text-ink text-base leading-snug font-medium sm:text-lg">
                  {item.question}
                </span>
                <ChevronDown
                  aria-hidden="true"
                  className={`text-accent-700 size-5 shrink-0 transition-transform duration-200 motion-reduce:transition-none ${open ? 'rotate-180' : ''}`}
                />
              </button>
            </h3>
            <div
              id={panelId}
              role="region"
              aria-labelledby={undefined}
              className={`grid transition-[grid-template-rows,opacity,visibility] duration-200 motion-reduce:transition-none ${
                open ? 'visible grid-rows-[1fr] opacity-100' : 'invisible grid-rows-[0fr] opacity-0'
              }`}
            >
              <div className="min-h-0 overflow-hidden">
                <div className="px-4 pb-4 sm:px-5">
                  <p className="text-ink-muted text-sm leading-7 sm:text-base">{item.answer}</p>
                  {item.links.length > 0 && (
                    <p className="mt-3 flex flex-wrap gap-x-5 gap-y-2">
                      {item.links.map((link) =>
                        link.external ? (
                          <a
                            key={link.label}
                            href={link.href}
                            target="_blank"
                            rel="noopener noreferrer"
                            className={linkClass}
                          >
                            {link.label}
                          </a>
                        ) : (
                          <Link key={link.label} href={link.href} className={linkClass}>
                            {link.label}
                          </Link>
                        ),
                      )}
                    </p>
                  )}
                </div>
              </div>
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Open-state helper: only one item is open at a time (opening one closes the others). */
export function useOpenSet(initial: number[] = []) {
  const [openIds, setOpenIds] = React.useState<Set<number>>(() => new Set(initial.slice(0, 1)));
  const toggle = React.useCallback((id: number) => {
    setOpenIds((current) => (current.has(id) ? new Set<number>() : new Set([id])));
  }, []);
  const open = React.useCallback((id: number) => setOpenIds(new Set([id])), []);
  return { openIds, toggle, open };
}
