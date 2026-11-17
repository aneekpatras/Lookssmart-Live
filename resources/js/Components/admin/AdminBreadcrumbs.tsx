import { Link, usePage } from '@inertiajs/react';
import { ArrowLeft, ChevronRight, Home } from 'lucide-react';
import * as React from 'react';

import { breadcrumbsFor } from '@/lib/adminBreadcrumbs';

const OverrideContext = React.createContext<{
  label: string | null;
  setLabel: (label: string | null) => void;
}>({ label: null, setLabel: () => {} });

/** Wraps the admin layout so a page can name its own last crumb (see useAdminBreadcrumb). */
export function AdminBreadcrumbProvider({ children }: { children: React.ReactNode }) {
  const [label, setLabel] = React.useState<string | null>(null);
  const value = React.useMemo(() => ({ label, setLabel }), [label]);

  return <OverrideContext.Provider value={value}>{children}</OverrideContext.Provider>;
}

/**
 * Optional per-page override: a nested page can show e.g. `Edit "Bridal makeup"`, and a page with
 * in-page sections (Settings tabs) can append the active section as the last crumb.
 */
export function useAdminBreadcrumb(label: string | null) {
  const { setLabel } = React.useContext(OverrideContext);

  React.useEffect(() => {
    setLabel(label);

    return () => setLabel(null);
  }, [label, setLabel]);
}

/**
 * "Dashboard > Section > Page > (Edit / New)" on every admin page. Every crumb is a link except the
 * current page (aria-current="page") and sections (no landing page). Nested pages also get a visible
 * "Back to <parent>" link. Below md only "<- parent" and the current title (truncated) are shown.
 */
export function AdminBreadcrumbs() {
  const { url } = usePage();
  const { label } = React.useContext(OverrideContext);
  const trail = breadcrumbsFor(url, label);
  const last = trail.crumbs.length - 1;
  const current = trail.crumbs[last];

  return (
    <nav aria-label="Breadcrumb" className="mb-4">
      {/* Phones: back to the parent, then the current title. */}
      <div className="flex min-w-0 items-center gap-2 text-sm md:hidden">
        {trail.parent?.href && (
          <Link
            href={trail.parent.href}
            className="text-accent-700 inline-flex shrink-0 items-center gap-1 font-medium hover:underline"
          >
            <ArrowLeft className="size-4" aria-hidden="true" />
            {trail.parent.label}
          </Link>
        )}
        {trail.parent?.href && (
          <span className="text-ink-muted" aria-hidden="true">
            /
          </span>
        )}
        <span className="text-ink min-w-0 truncate font-medium" aria-current="page">
          {current?.label}
        </span>
      </div>

      <ol className="hidden flex-wrap items-center gap-1.5 text-sm md:flex">
        {trail.crumbs.map((crumb, index) => (
          <li key={`${crumb.label}-${index}`} className="flex items-center gap-1.5">
            {index > 0 && <ChevronRight className="text-ink-muted size-3.5" aria-hidden="true" />}
            {index === last ? (
              <span className="text-ink font-medium" aria-current="page">
                {index === 0 && (
                  <Home className="mr-1 inline size-4 align-[-2px]" aria-hidden="true" />
                )}
                {crumb.label}
              </span>
            ) : crumb.href ? (
              <Link
                href={crumb.href}
                className="text-ink-muted hover:text-accent-700 hover:underline"
              >
                {index === 0 && (
                  <Home className="mr-1 inline size-4 align-[-2px]" aria-hidden="true" />
                )}
                {crumb.label}
              </Link>
            ) : (
              <span className="text-ink-muted">{crumb.label}</span>
            )}
          </li>
        ))}
      </ol>

      {trail.nested && trail.parent?.href && (
        <Link
          href={trail.parent.href}
          className="text-accent-700 mt-3 hidden items-center gap-1.5 text-sm font-medium hover:underline md:inline-flex"
        >
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to {trail.parent.label}
        </Link>
      )}
    </nav>
  );
}
