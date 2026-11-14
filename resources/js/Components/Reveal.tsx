import * as React from 'react';

/**
 * Scroll reveal: fades and lifts its children (opacity + a 12px translate only, 400ms) the first time
 * they scroll into view, then stays put. Uses one IntersectionObserver per element and disconnects as
 * soon as it has played. No layout shift (transform/opacity do not reflow), and prefers-reduced-motion
 * shows the content immediately. Never wrap the hero, anything above the fold, or a marquee in this.
 */
export function Reveal({
  children,
  className = '',
}: {
  children: React.ReactNode;
  className?: string;
}) {
  const ref = React.useRef<HTMLDivElement>(null);
  const [shown, setShown] = React.useState(false);

  React.useEffect(() => {
    const node = ref.current;
    if (!node) return;
    if (
      typeof IntersectionObserver === 'undefined' ||
      window.matchMedia('(prefers-reduced-motion: reduce)').matches
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setShown(true);
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setShown(true);
          observer.disconnect();
        }
      },
      { rootMargin: '0px 0px -8% 0px' },
    );
    observer.observe(node);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`transition-[opacity,transform] duration-[400ms] ease-out motion-reduce:transition-none ${
        shown ? 'translate-y-0 opacity-100' : 'translate-y-3 opacity-0 motion-reduce:opacity-100'
      } ${className}`}
    >
      {children}
    </div>
  );
}
