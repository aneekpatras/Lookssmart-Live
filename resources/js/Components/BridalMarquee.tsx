import * as React from 'react';

export interface MarqueeImage {
  id: number | string;
  url: string;
  webp_url?: string | null;
  alt: string;
}

interface BridalMarqueeProps {
  images: MarqueeImage[];
}

/** Seconds each photo takes to travel past — the brief's "3-second cycle", applied per photo. */
const SECONDS_PER_CARD = 3;
/** After a touch, wheel or drag the auto-scroll waits this long before carrying on by itself. */
const RESUME_AFTER_MS = 1500;
/** The photos are rendered this many times; the middle copy is the one the visitor lives in. */
const COPIES = 3;

/**
 * Auto-scrolling bridal photo marquee.
 *
 * Driven by real `scrollLeft`, not a CSS transform (the previous version animated a transform on top
 * of a native scroller, so a drag and the animation fought each other and dragging far enough left
 * empty space behind the last photo). With one scroll position there is nothing to fight:
 *   - auto-scroll nudges `scrollLeft` every frame (`scrollLeft` is a DOM property, not an inline
 *     style, so this app's no-`unsafe-inline` CSP is irrelevant);
 *   - touch, trackpad and wheel scrolling are the browser's own native behaviour;
 *   - mouse dragging is handled here (a mouse can't drag a scroller natively).
 *
 * Endless loop: the photos are rendered three times and `scrollLeft` is kept inside the middle copy.
 * Whenever it leaves it, it is moved by exactly one copy's width — the content on screen is
 * pixel-identical before and after, so the jump is invisible in either direction. Only the first copy
 * is exposed to assistive tech.
 *
 * Auto-scroll pauses on a real mouse move over it, while touching/dragging, and for a moment after any manual scroll, and
 * does not run at all under `prefers-reduced-motion` (the strip can still be scrolled by hand).
 */
export function BridalMarquee({ images }: BridalMarqueeProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLUListElement>(null);
  // Written by event handlers, read by the animation loop — refs, so a pause never re-renders.
  const hovering = React.useRef(false);
  const holding = React.useRef(false);
  const resumeAt = React.useRef(0);
  const dragStart = React.useRef<{ x: number; scrollLeft: number } | null>(null);
  const [grabbing, setGrabbing] = React.useState(false);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || images.length === 0) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    let onePass = track.scrollWidth / COPIES;
    let pxPerSecond = 0;
    let position = 0;
    let frame = 0;
    let lastTime = performance.now();
    let idleTimer: number | undefined;

    function measure() {
      const card = track?.firstElementChild as HTMLElement | null;
      if (!card || !track) return;
      const gap = Number.parseFloat(getComputedStyle(track).columnGap) || 0;
      pxPerSecond = (card.offsetWidth + gap) / SECONDS_PER_CARD;
      onePass = track.scrollWidth / COPIES;
    }

    /** Moves scrollLeft back into the middle copy, by whole copies only, so nothing visibly jumps. */
    function wrap(value: number): number {
      if (onePass <= 0) return value;
      let next = value;
      while (next >= onePass * 1.5) next -= onePass;
      while (next < onePass * 0.5) next += onePass;
      return next;
    }

    measure();
    position = onePass; // start at the beginning of the middle copy
    viewport.scrollLeft = position;

    // Layout changes (rotating a phone, resizing the window) change the card width, so the same
    // photo has to stay in view: rescale the position by the change in one pass.
    const observer = new ResizeObserver(() => {
      const before = onePass;
      measure();
      if (before > 0 && onePass > 0 && before !== onePass) {
        position = wrap((viewport.scrollLeft / before) * onePass);
        viewport.scrollLeft = position;
      }
    });
    observer.observe(track);

    function tick(now: number) {
      const elapsed = Math.min(now - lastTime, 64);
      lastTime = now;

      const paused =
        hovering.current || holding.current || now < resumeAt.current || reducedMotion.matches;

      if (paused || pxPerSecond === 0) {
        position = viewport!.scrollLeft; // follow whatever the visitor is doing
      } else {
        position = wrap(position + (pxPerSecond * elapsed) / 1000);
        viewport!.scrollLeft = position;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    // A manual scroll (touch fling, trackpad, wheel, drag) can carry the position out of the middle
    // copy. Re-centre once it settles — not mid-gesture, which can cancel a touch fling's momentum —
    // and straight away only if it is about to run off either end of the whole track.
    function onScroll() {
      const current = viewport!.scrollLeft;
      const nearEnd =
        current < onePass * 0.15 || current > onePass * (COPIES - 0.15) - viewport!.clientWidth;
      window.clearTimeout(idleTimer);
      if (nearEnd) {
        viewport!.scrollLeft = wrap(current);
        return;
      }
      idleTimer = window.setTimeout(() => {
        const settled = viewport!.scrollLeft;
        const wrapped = wrap(settled);
        if (wrapped !== settled) viewport!.scrollLeft = wrapped;
      }, 150);
    }
    viewport.addEventListener('scroll', onScroll, { passive: true });

    // Scrolling the PAGE (wheel, keys, scrollbar) must never leave the strip paused just because the
    // pointer happens to rest over it: any page scroll or wheel clears the hover pause.
    function clearHover() {
      hovering.current = false;
    }
    window.addEventListener('scroll', clearHover, { passive: true });
    window.addEventListener('wheel', clearHover, { passive: true });

    return () => {
      cancelAnimationFrame(frame);
      window.clearTimeout(idleTimer);
      observer.disconnect();
      viewport.removeEventListener('scroll', onScroll);
      window.removeEventListener('scroll', clearHover);
      window.removeEventListener('wheel', clearHover);
    };
  }, [images.length]);

  if (images.length === 0) {
    return null;
  }

  function holdNow() {
    holding.current = true;
  }

  function releaseSoon() {
    holding.current = false;
    resumeAt.current = performance.now() + RESUME_AFTER_MS;
  }

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'mouse' || event.button !== 0) return; // touch/pen scroll natively
    holdNow();
    dragStart.current = { x: event.clientX, scrollLeft: event.currentTarget.scrollLeft };
    setGrabbing(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    // Hover-pause starts only on a REAL mouse movement inside the strip. `pointerenter` also fires when
    // the page scrolls the strip under a stationary pointer, and browsers emit a synthetic move with
    // zero movement then, so those are ignored.
    if (event.pointerType === 'mouse' && (event.movementX !== 0 || event.movementY !== 0)) {
      hovering.current = true;
    }
    const start = dragStart.current;
    if (!start) return;
    event.currentTarget.scrollLeft = start.scrollLeft - (event.clientX - start.x);
  }

  function endMouseDrag(event: React.PointerEvent<HTMLDivElement>) {
    if (!dragStart.current) return;
    dragStart.current = null;
    setGrabbing(false);
    releaseSoon();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
  }

  return (
    <div
      ref={viewportRef}
      className={`marquee-viewport relative ${grabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
      // Pointer events (mouse only): a touch tap also fires emulated mouse events that never get a
      // matching "leave", which would leave the strip paused for good on a phone.
      onPointerLeave={(event) => {
        if (event.pointerType === 'mouse') hovering.current = false;
      }}
      onTouchStart={holdNow}
      onTouchEnd={releaseSoon}
      onTouchCancel={releaseSoon}
      onWheel={(event) => {
        hovering.current = false; // a wheel scroll resumes the strip straight away
        // Only a sideways wheel/trackpad swipe is the visitor steering the strip itself.
        if (Math.abs(event.deltaX) > Math.abs(event.deltaY)) {
          resumeAt.current = performance.now() + RESUME_AFTER_MS;
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endMouseDrag}
      onPointerCancel={endMouseDrag}
    >
      <ul
        ref={trackRef}
        className="marquee-track m-0 flex list-none gap-3 p-0 pr-3 sm:gap-5 sm:pr-5"
      >
        {Array.from({ length: COPIES }, (_, copy) =>
          images.map((image) => (
            <MarqueeCard key={`${copy}-${image.id}`} image={image} duplicate={copy > 0} />
          )),
        )}
      </ul>
    </div>
  );
}

function MarqueeCard({ image, duplicate = false }: { image: MarqueeImage; duplicate?: boolean }) {
  return (
    <li
      className="w-[38vw] max-w-[190px] shrink-0 sm:w-[264px] sm:max-w-none"
      aria-hidden={duplicate ? 'true' : undefined}
    >
      <div className="shadow-soft bg-accent-50 aspect-[3/4] overflow-hidden rounded-2xl">
        {/* <picture> so an uploaded image's generated .webp sibling is preferred where one exists,
            with the original as the fallback source — same pattern as the gallery page. */}
        <picture>
          {image.webp_url && <source srcSet={image.webp_url} type="image/webp" />}
          <img
            src={image.url}
            alt={duplicate ? '' : image.alt}
            loading="lazy"
            decoding="async"
            draggable={false}
            className="size-full object-cover"
          />
        </picture>
      </div>
    </li>
  );
}
