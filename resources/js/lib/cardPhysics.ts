import type MatterNS from 'matter-js';

/**
 * Falling, draggable cards for the 404 page. matter-js is passed in (it is loaded with a dynamic import()
 * by the page, so no other page ever downloads it); this module only has a type import of it.
 *
 * Matter does the physics only. The cards are ordinary DOM elements, positioned every frame from their
 * body through the CSSOM (`element.style.transform`), which the CSP allows (it blocks style ATTRIBUTES in
 * markup, not CSSOM writes). The loop uses a fixed 60 Hz timestep and stops when the stage is off screen,
 * the tab is hidden, or everything has gone to sleep; pointer events and resizes wake it again.
 */

type Matter = typeof MatterNS;

export interface CardPhysics {
  /** Lift every card back above the stage and let them rain down again. */
  respawn: () => void;
  /** Stop the loop and remove every listener, timer, body and the engine. */
  destroy: () => void;
}

const STEP = 1000 / 60;
const STAGGER_MS = 140;
const MAX_THROW_SPEED = 40;

export function startCardPhysics(M: Matter, stage: HTMLElement, cards: HTMLElement[]): CardPhysics {
  const { Engine, Bodies, Body, Composite, Sleeping, Events } = M;

  const engine = Engine.create({ enableSleeping: true });
  engine.gravity.y = 1;

  let width = stage.clientWidth;
  let height = stage.clientHeight;
  let walls: MatterNS.Body[] = [];

  const bodies = new Map<HTMLElement, MatterNS.Body>();
  const timers = new Set<number>();
  const cleanups: Array<() => void> = [];
  let pendingSpawns = 0;
  let raf = 0;
  let last = 0;
  let acc = 0;
  let onScreen = true;
  let destroyed = false;
  let zTop = 10;

  interface Drag {
    el: HTMLElement;
    body: MatterNS.Body;
    pointerId: number;
    offsetX: number;
    offsetY: number;
    targetX: number;
    targetY: number;
  }
  let drag: Drag | null = null;

  const isVisible = (el: HTMLElement) => el.getClientRects().length > 0;

  function buildWalls() {
    if (walls.length) Composite.remove(engine.world, walls);
    const floorTop = height - 6; // slightly inside the bottom so settled cards rest visibly
    walls = [
      Bodies.rectangle(width / 2, floorTop + 60, width + 400, 120, {
        isStatic: true,
        friction: 0.6,
      }),
      Bodies.rectangle(-60, height / 2 - 1000, 120, height + 2000, { isStatic: true }),
      Bodies.rectangle(width + 60, height / 2 - 1000, 120, height + 2000, { isStatic: true }),
    ];
    Composite.add(engine.world, walls);
  }

  function makeBody(el: HTMLElement): MatterNS.Body {
    const w = el.offsetWidth;
    const h = el.offsetHeight;

    return Bodies.rectangle(width / 2, -h, w, h, {
      restitution: 0.25,
      friction: 0.5,
      frictionStatic: 0.6,
      frictionAir: 0.01,
      density: 0.002,
      sleepThreshold: 45,
    });
  }

  function place(el: HTMLElement, body: MatterNS.Body) {
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    el.style.transform = `translate3d(${body.position.x - w / 2}px, ${body.position.y - h / 2}px, 0) rotate(${body.angle}rad)`;
  }

  function spawnOne(el: HTMLElement) {
    if (destroyed || !isVisible(el)) return;
    let body = bodies.get(el);
    if (!body) {
      body = makeBody(el);
      bodies.set(el, body);
    }
    const w = el.offsetWidth;
    const h = el.offsetHeight;
    const x = w / 2 + Math.random() * Math.max(1, width - w);
    Body.setPosition(body, { x, y: -h - Math.random() * 200 });
    Body.setAngle(body, (Math.random() - 0.5) * Math.PI);
    Body.setVelocity(body, { x: 0, y: 0 });
    Body.setAngularVelocity(body, (Math.random() - 0.5) * 0.1);
    Sleeping.set(body, false);
    if (!Composite.get(engine.world, body.id, 'body')) Composite.add(engine.world, body);
    place(el, body);
    el.classList.add('opacity-100');
  }

  function spawnAll() {
    timers.forEach((t) => window.clearTimeout(t));
    timers.clear();
    pendingSpawns = 0;

    const visible = cards.filter(isVisible);
    visible.forEach((el, i) => {
      const body = bodies.get(el);
      if (body) Composite.remove(engine.world, body);
      el.style.transform = `translate3d(0, ${-el.offsetHeight - 40}px, 0)`;

      pendingSpawns++;
      const timer = window.setTimeout(() => {
        timers.delete(timer);
        pendingSpawns--;
        spawnOne(el);
        start();
      }, i * STAGGER_MS);
      timers.add(timer);
    });
    start();
  }

  function allAsleep(): boolean {
    for (const body of bodies.values()) {
      if (Composite.get(engine.world, body.id, 'body') && !body.isSleeping) return false;
    }

    return true;
  }

  function frame(now: number) {
    raf = 0;
    if (destroyed) return;
    if (!onScreen || document.hidden) {
      last = 0;
      return;
    }

    acc += last ? Math.min(now - last, 100) : STEP;
    last = now;
    let steps = 0;
    while (acc >= STEP && steps < 5) {
      Engine.update(engine, STEP);
      acc -= STEP;
      steps++;
    }

    for (const [el, body] of bodies) {
      if (!body.isSleeping || drag?.body === body) place(el, body);
    }

    if (!drag && pendingSpawns === 0 && allAsleep()) {
      last = 0;
      return; // everything settled: nothing to animate until something wakes it up
    }
    raf = requestAnimationFrame(frame);
  }

  function start() {
    if (destroyed || raf || !onScreen || document.hidden) return;
    last = 0;
    raf = requestAnimationFrame(frame);
  }

  // While a card is held, steer it toward the pointer by velocity, so it still pushes other cards and keeps
  // its speed when let go (that is the throw).
  Events.on(engine, 'beforeUpdate', () => {
    if (!drag) return;
    const { body, targetX, targetY, offsetX, offsetY } = drag;
    Sleeping.set(body, false);
    let vx = (targetX - offsetX - body.position.x) * 0.35;
    let vy = (targetY - offsetY - body.position.y) * 0.35;
    const speed = Math.hypot(vx, vy);
    if (speed > MAX_THROW_SPEED) {
      vx = (vx / speed) * MAX_THROW_SPEED;
      vy = (vy / speed) * MAX_THROW_SPEED;
    }
    Body.setVelocity(body, { x: vx, y: vy });
    Body.setAngularVelocity(body, body.angularVelocity * 0.85);
  });

  function stagePoint(event: PointerEvent) {
    const rect = stage.getBoundingClientRect();

    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function clampTarget(el: HTMLElement, x: number, y: number, offsetX: number, offsetY: number) {
    const w = el.offsetWidth / 2;
    const h = el.offsetHeight / 2;

    return {
      x: Math.min(width - w + offsetX, Math.max(w + offsetX, x)),
      y: Math.min(height - h + offsetY, Math.max(h + offsetY, y)),
    };
  }

  for (const el of cards) {
    const onDown = (event: PointerEvent) => {
      const body = bodies.get(el);
      if (!body || drag || (event.pointerType === 'mouse' && event.button !== 0)) return;

      event.preventDefault();
      el.setPointerCapture(event.pointerId);
      const point = stagePoint(event);
      drag = {
        el,
        body,
        pointerId: event.pointerId,
        offsetX: point.x - body.position.x,
        offsetY: point.y - body.position.y,
        targetX: point.x,
        targetY: point.y,
      };
      zTop++;
      el.style.zIndex = String(zTop);
      el.classList.remove('cursor-grab');
      el.classList.add('cursor-grabbing');
      Sleeping.set(body, false);
      start();
    };
    const onMove = (event: PointerEvent) => {
      if (!drag || drag.el !== el || event.pointerId !== drag.pointerId) return;
      const point = stagePoint(event);
      const clamped = clampTarget(el, point.x, point.y, drag.offsetX, drag.offsetY);
      drag.targetX = clamped.x;
      drag.targetY = clamped.y;
    };
    const onUp = (event: PointerEvent) => {
      if (!drag || drag.el !== el || event.pointerId !== drag.pointerId) return;
      if (el.hasPointerCapture(event.pointerId)) el.releasePointerCapture(event.pointerId);
      el.classList.remove('cursor-grabbing');
      el.classList.add('cursor-grab');
      Sleeping.set(drag.body, false);
      drag = null;
      start();
    };

    el.addEventListener('pointerdown', onDown);
    el.addEventListener('pointermove', onMove);
    el.addEventListener('pointerup', onUp);
    el.addEventListener('pointercancel', onUp);
    cleanups.push(() => {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onUp);
    });
  }

  // Visibility: no frames while off screen or in a background tab.
  const observer = new IntersectionObserver(([entry]) => {
    onScreen = entry?.isIntersecting ?? true;
    if (onScreen) start();
  });
  observer.observe(stage);
  const onVisibility = () => {
    if (!document.hidden) start();
  };
  document.addEventListener('visibilitychange', onVisibility);
  cleanups.push(() => {
    observer.disconnect();
    document.removeEventListener('visibilitychange', onVisibility);
  });

  // Resize: rebuild the bounds (debounced), keep every card inside, and sync cards that a breakpoint
  // showed or hid.
  let resizeTimer = 0;
  const resize = new ResizeObserver(() => {
    window.clearTimeout(resizeTimer);
    resizeTimer = window.setTimeout(() => {
      if (destroyed) return;
      const w = stage.clientWidth;
      const h = stage.clientHeight;
      if (w === width && h === height) return;
      width = w;
      height = h;
      buildWalls();

      for (const el of cards) {
        const body = bodies.get(el);
        const visible = isVisible(el);
        if (!visible && body) {
          Composite.remove(engine.world, body);
          bodies.delete(el);
        } else if (visible && !body) {
          spawnOne(el);
        } else if (visible && body) {
          const halfW = el.offsetWidth / 2;
          const halfH = el.offsetHeight / 2;
          Body.setPosition(body, {
            x: Math.min(width - halfW, Math.max(halfW, body.position.x)),
            y: Math.min(height - halfH - 6, body.position.y),
          });
          Sleeping.set(body, false);
        }
      }
      start();
    }, 150);
  });
  resize.observe(stage);
  cleanups.push(() => {
    window.clearTimeout(resizeTimer);
    resize.disconnect();
  });

  buildWalls();
  spawnAll();

  return {
    respawn: spawnAll,
    destroy() {
      destroyed = true;
      if (raf) cancelAnimationFrame(raf);
      raf = 0;
      timers.forEach((t) => window.clearTimeout(t));
      timers.clear();
      cleanups.forEach((fn) => fn());
      Events.off(engine, 'beforeUpdate');
      Composite.clear(engine.world, false);
      Engine.clear(engine);
      bodies.clear();
      drag = null;
    },
  };
}
