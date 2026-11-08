import * as React from 'react';

/**
 * Header + category-tags handoff for long, sectioned catalog pages (Services, Deals): while scrolling
 * down with the tags bar stuck, the floating header slides away and the tags take its place at the
 * very top; any scroll up brings the header back and the tags settle just beneath it.
 *
 * The header hides itself via `data-header-hidden` on <html> (see PublicLayout) — this hook only
 * decides when. Returns `[ref, style]`; attach both to a `position: sticky` wrapper around the tags bar.
 */
export function useHeaderHandoff() {
  const ref = React.useRef<HTMLDivElement>(null);
  const [headerHeight, setHeaderHeight] = React.useState(84);
  const [headerHidden, setHeaderHidden] = React.useState(false);

  React.useEffect(() => {
    const header = document.querySelector('header');
    if (!header) return;
    // offsetHeight, not getBoundingClientRect: the latter shrinks to 0 while the header is slid away.
    const update = () => setHeaderHeight(header.offsetHeight);
    update();
    const observer = new ResizeObserver(update);
    observer.observe(header);
    return () => observer.disconnect();
  }, []);

  React.useEffect(() => {
    let lastY = window.scrollY;

    function onScroll() {
      const y = window.scrollY;
      const delta = y - lastY;
      if (Math.abs(delta) < 6) return;
      lastY = y;
      const stuck = (ref.current?.getBoundingClientRect().top ?? Infinity) <= headerHeight + 4;
      setHeaderHidden(delta > 0 && stuck);
    }

    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, [headerHeight]);

  React.useEffect(() => {
    document.documentElement.dataset.headerHidden = String(headerHidden);
    return () => {
      delete document.documentElement.dataset.headerHidden;
    };
  }, [headerHidden]);

  const style: React.CSSProperties = { top: headerHidden ? 0 : headerHeight - 2 };
  return [ref, style] as const;
}
