import * as React from 'react';

/** After a touch, a sideways wheel or a drag the auto-scroll waits this long before carrying on. */
const RESUME_AFTER_MS = 1500;
/** The items are rendered this many times; the middle copy is the one the visitor lives in. */
const COPIES = 3;
/** A mouse drag longer than this (px) is a drag, so the click that follows it must not navigate. */
const DRAG_CLICK_THRESHOLD = 6;

interface AutoMarqueeProps {
  /** How many distinct items there are (rendered `COPIES` times). */
  count: number;
  /** Renders ONE `<li>`; `duplicate` is true for every copy after the first (hide those from assistive tech). */
  renderItem: (index: number, duplicate: boolean) => React.ReactNode;
  /** Seconds each item takes to travel past. */
  secondsPerCard?: number;
  /** Move left-to-right instead of the default right-to-left. */
  reverse?: boolean;
  /** Tailwind classes for the track (gap and end padding). */
  trackClassName?: string;
  /** Accessible name of the list region. */
  label?: string;
}

/**
 * Auto-scrolling strip, driven by real `scrollLeft` (not a CSS transform) so drag, touch and trackpad
 * scrolling are the browser's own and never fight the animation.
 *
 *   - Endless loop: the items are rendered three times and `scrollLeft` is kept inside the middle copy,
 *     moved by exactly one copy's width whenever it leaves it (invisible, in either direction).
 *   - Pauses only on a REAL mouse move over it (a pointer resting still while the page scrolls under it
 *     does not count), while touching/dragging, and briefly after a sideways swipe. Any page scroll or
 *     wheel clears the hover pause. Keyboard focus inside pauses it too.
 *   - Does not run at all under `prefers-reduced-motion` (it can still be scrolled by hand).
 *   - `reverse` flips the direction, so two rows can run against each other.
 */
export function AutoMarquee({
  count,
  renderItem,
  secondsPerCard = 3,
  reverse = false,
  trackClassName = 'gap-3 pr-3 sm:gap-5 sm:pr-5',
  label,
}: AutoMarqueeProps) {
  const viewportRef = React.useRef<HTMLDivElement>(null);
  const trackRef = React.useRef<HTMLUListElement>(null);
  // Written by event handlers, read by the animation loop — refs, so a pause never re-renders.
  const hovering = React.useRef(false);
  const holding = React.useRef(false);
  const focusing = React.useRef(false);
  const resumeAt = React.useRef(0);
  const dragStart = React.useRef<{ x: number; scrollLeft: number; moved: boolean } | null>(null);
  const justDragged = React.useRef(false);
  const [grabbing, setGrabbing] = React.useState(false);

  React.useEffect(() => {
    const viewport = viewportRef.current;
    const track = trackRef.current;
    if (!viewport || !track || count === 0) return;

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
    const direction = reverse ? -1 : 1;
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
      pxPerSecond = (card.offsetWidth + gap) / secondsPerCard;
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

    // Layout changes (rotating a phone, resizing) change the card width: rescale so the same item
    // stays in view.
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
        hovering.current ||
        holding.current ||
        focusing.current ||
        now < resumeAt.current ||
        reducedMotion.matches;

      if (paused || pxPerSecond === 0) {
        position = viewport!.scrollLeft; // follow whatever the visitor is doing
      } else {
        position = wrap(position + (direction * pxPerSecond * elapsed) / 1000);
        viewport!.scrollLeft = position;
      }
      frame = requestAnimationFrame(tick);
    }
    frame = requestAnimationFrame(tick);

    // A manual scroll can carry the position out of the middle copy. Re-centre once it settles — not
    // mid-gesture, which can cancel a touch fling's momentum — and straight away only if it is about
    // to run off either end of the whole track.
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
    // pointer happens to rest over it.
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
  }, [count, reverse, secondsPerCard]);

  if (count === 0) {
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
    // Pointer capture is deliberately NOT taken here: capturing on press makes the browser deliver the
    // following click to the strip instead of the button/link under the pointer, which silently
    // breaks every control inside a card. It is taken only once the press turns into a real drag.
    dragStart.current = {
      x: event.clientX,
      scrollLeft: event.currentTarget.scrollLeft,
      moved: false,
    };
    justDragged.current = false;
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    // Hover-pause starts only on a REAL mouse movement inside the strip: `pointerenter` also fires when
    // the page scrolls the strip under a stationary pointer, and browsers emit a synthetic move with
    // zero movement then, so those are ignored.
    if (event.pointerType === 'mouse' && (event.movementX !== 0 || event.movementY !== 0)) {
      hovering.current = true;
    }
    const start = dragStart.current;
    if (!start) return;
    const delta = event.clientX - start.x;
    if (!start.moved && Math.abs(delta) > DRAG_CLICK_THRESHOLD) {
      start.moved = true;
      setGrabbing(true);
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    if (start.moved) event.currentTarget.scrollLeft = start.scrollLeft - delta;
  }

  function endMouseDrag(event: React.PointerEvent<HTMLDivElement>) {
    const start = dragStart.current;
    if (!start) return;
    justDragged.current = start.moved;
    dragStart.current = null;
    setGrabbing(false);
    releaseSoon();
    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }
    // The click that ends a drag must not open whatever card was under the pointer.
    window.setTimeout(() => {
      justDragged.current = false;
    }, 0);
  }

  return (
    <div
      ref={viewportRef}
      className={`marquee-viewport relative ${grabbing ? 'cursor-grabbing' : 'cursor-grab'}`}
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
      onFocusCapture={() => {
        focusing.current = true;
      }}
      onBlurCapture={() => {
        focusing.current = false;
      }}
      onClickCapture={(event) => {
        if (justDragged.current) {
          event.preventDefault();
          event.stopPropagation();
        }
      }}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={endMouseDrag}
      onPointerCancel={endMouseDrag}
    >
      <ul
        ref={trackRef}
        aria-label={label}
        className={`marquee-track m-0 flex list-none p-0 ${trackClassName}`}
      >
        {Array.from({ length: COPIES }, (_, copy) =>
          Array.from({ length: count }, (_, index) => (
            <React.Fragment key={`${copy}-${index}`}>{renderItem(index, copy > 0)}</React.Fragment>
          )),
        )}
      </ul>
    </div>
  );
}
