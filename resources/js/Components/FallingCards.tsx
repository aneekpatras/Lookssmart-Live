import {
  Brush,
  Flower2,
  Gem,
  Hand,
  Heart,
  type LucideIcon,
  Scissors,
  Smile,
  Sparkles,
} from 'lucide-react';
import * as React from 'react';

/**
 * Decorative cards that fall and can be played with (see lib/cardPhysics.ts). Shared by the 404 page and the
 * auth pages' brand panel. Labels are real salon categories. Colours are theme tokens only (admin theme changes
 * apply); text is espresso or ivory, whichever reads on the card. `show` keeps 5 cards on phones, 6 from md and
 * 8 from lg. `spot` is the resting place of the static layout (server HTML, reduced motion).
 */
const CARDS: {
  label: string;
  Icon: LucideIcon;
  tone: string;
  size: string;
  show: string;
  spot: string;
}[] = [
  {
    label: 'Hair',
    Icon: Scissors,
    tone: 'bg-accent-500 text-ink border-accent-500',
    size: 'h-[104px] w-[84px] md:h-[120px] md:w-[96px] lg:h-[132px] lg:w-[108px]',
    show: 'flex',
    spot: 'bottom-3 left-[3%] -rotate-6',
  },
  {
    label: 'Skin',
    Icon: Sparkles,
    tone: 'bg-ink text-ivory border-accent-500/60',
    size: 'h-[112px] w-[88px] md:h-[124px] md:w-[100px] lg:h-[140px] lg:w-[112px]',
    show: 'flex',
    spot: 'bottom-3 left-[18%] rotate-3',
  },
  {
    label: 'Bridal',
    Icon: Heart,
    tone: 'bg-accent-100 text-ink border-accent-300',
    size: 'h-[108px] w-[92px] md:h-[120px] md:w-[104px] lg:h-[132px] lg:w-[120px]',
    show: 'flex',
    spot: 'bottom-3 left-[36%] -rotate-3',
  },
  {
    label: 'Makeup',
    Icon: Brush,
    tone: 'bg-accent-300 text-ink border-accent-300',
    size: 'h-[100px] w-[88px] md:h-[116px] md:w-[100px] lg:h-[128px] lg:w-[112px]',
    show: 'flex',
    spot: 'bottom-3 right-[30%] rotate-6',
  },
  {
    label: 'Waxing',
    Icon: Flower2,
    tone: 'bg-tint-b text-ink border-accent-300',
    size: 'h-[104px] w-[84px] md:h-[118px] md:w-[96px] lg:h-[130px] lg:w-[108px]',
    show: 'flex',
    spot: 'bottom-3 right-[14%] -rotate-6',
  },
  {
    label: 'Spa',
    Icon: Gem,
    tone: 'bg-cream text-ink border-accent-300',
    size: 'h-[110px] w-[90px] md:h-[122px] md:w-[98px] lg:h-[136px] lg:w-[110px]',
    show: 'hidden md:flex',
    spot: 'bottom-3 right-[2%] rotate-3',
  },
  {
    label: 'Nails',
    Icon: Hand,
    tone: 'bg-ivory text-ink border-accent-300',
    size: 'h-[104px] w-[86px] md:h-[116px] md:w-[96px] lg:h-[126px] lg:w-[106px]',
    show: 'hidden lg:flex',
    spot: 'bottom-24 left-[10%] rotate-2',
  },
  {
    label: 'Facial',
    Icon: Smile,
    tone: 'bg-tint-d text-ink border-accent-300',
    size: 'h-[104px] w-[88px] md:h-[116px] md:w-[98px] lg:h-[128px] lg:w-[110px]',
    show: 'hidden lg:flex',
    spot: 'bottom-24 right-[8%] -rotate-3',
  },
];

/**
 * Fills its (relatively positioned, overflow-hidden) parent with the cards. They start as a static arrangement
 * (server HTML, reduced motion, or if matter-js fails to load); otherwise matter-js is imported dynamically
 * (these pages only), the static layout is swapped for the physics layout and the cards rain down.
 * Raise `respawnKey` to drop them again; `onPhysicsChange` says whether the physics is running.
 */
export function FallingCards({
  respawnKey = 0,
  onPhysicsChange,
}: {
  respawnKey?: number;
  onPhysicsChange?: (active: boolean) => void;
}) {
  const layerRef = React.useRef<HTMLDivElement>(null);
  const cardRefs = React.useRef<(HTMLDivElement | null)[]>([]);
  const physicsRef = React.useRef<{ respawn: () => void } | null>(null);
  const [mode, setMode] = React.useState<'static' | 'physics'>('static');

  // Phase 1: unless the visitor prefers reduced motion, fetch matter-js.
  React.useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    let cancelled = false;
    void import('matter-js')
      .then(() => {
        if (!cancelled) setMode('physics');
      })
      .catch(() => {
        // Could not load: the static layout simply stays.
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Phase 2: the physics layout is rendered (cards measured at their real sizes), start the simulation.
  React.useEffect(() => {
    const layer = layerRef.current;
    if (mode !== 'physics' || !layer) return;

    let destroy: (() => void) | null = null;
    let cancelled = false;

    void Promise.all([import('matter-js'), import('@/lib/cardPhysics')])
      .then(([matter, physics]) => {
        if (cancelled) return;
        const M = (matter as { default?: unknown }).default ?? matter;
        const cards = cardRefs.current.filter((el): el is HTMLDivElement => el !== null);
        const instance = physics.startCardPhysics(
          M as Parameters<typeof physics.startCardPhysics>[0],
          layer,
          cards,
        );
        physicsRef.current = instance;
        destroy = instance.destroy;
        onPhysicsChange?.(true);
      })
      .catch(() => {
        if (!cancelled) setMode('static');
      });

    return () => {
      cancelled = true;
      physicsRef.current = null;
      destroy?.();
      onPhysicsChange?.(false);
    };
  }, [mode, onPhysicsChange]);

  const first = React.useRef(true);
  React.useEffect(() => {
    if (first.current) {
      first.current = false;
      return;
    }
    physicsRef.current?.respawn();
  }, [respawnKey]);

  const physics = mode === 'physics';

  return (
    <div ref={layerRef} className="absolute inset-0">
      {CARDS.map((card, index) => (
        <div
          key={card.label}
          ref={(el) => {
            cardRefs.current[index] = el;
          }}
          aria-hidden="true"
          className={`${card.show} ${card.size} ${card.tone} font-display absolute flex-col items-center justify-center gap-2 rounded-2xl border shadow-lg will-change-transform select-none ${
            physics
              ? 'top-0 left-0 cursor-grab touch-none opacity-0 transition-opacity duration-300'
              : card.spot
          }`}
        >
          <card.Icon className="size-7" aria-hidden="true" />
          <span className="text-base">{card.label}</span>
        </div>
      ))}
    </div>
  );
}
