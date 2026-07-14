// The haunting: the margins are where the dead go. Spent letters rise from
// the tile that dropped them and scatter around the board, aging outward
// and dimming, never leaving. The engine owns age (the play index that
// spent each letter); this component reads it, measures the board, and
// hands both to the pure layout in haunt-layout.ts. It never tracks state
// of its own beyond the measured geometry.
//
// The ghosts live on an absolutely positioned layer behind the board and
// are pointer transparent; they never intersect the pool, the input, the
// controls, or the stack, which the layout guarantees by construction.
import {
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
  type CSSProperties,
} from 'react';
import type { SpentLetter } from '../../engine/run';
import {
  GHOST_HEIGHT,
  GHOST_WIDTH,
  layoutHaunt,
  type HauntGeometry,
  type Rect,
} from '../haunt-layout';

/** Where a freshly spent tile sat when Spend was pressed, in layer
 * coordinates. Only the play that just happened has births; a reload does
 * not, so the dead settle without re-rising. */
export interface GhostBirth {
  letter: string;
  x: number;
  y: number;
}

export interface HauntBirths {
  playIndex: number;
  at: readonly GhostBirth[];
}

export interface HauntProps {
  spent: readonly SpentLetter[];
  currentPlayCount: number;
  reducedMotion: boolean;
  births: HauntBirths | null;
}

const BOARD_PARTS = [
  '[data-testid="pool"]',
  '[data-testid="word-display"]',
  '[data-testid="control-row"]',
  '[data-testid="stack"]',
  '.rest-row',
];

function sameRect(a: Rect, b: Rect): boolean {
  return (
    a.left === b.left &&
    a.top === b.top &&
    a.width === b.width &&
    a.height === b.height
  );
}

function measure(layer: HTMLElement): HauntGeometry {
  const root = layer.closest('.app') ?? document;
  const layerBox = layer.getBoundingClientRect();
  let left = Infinity;
  let top = Infinity;
  let right = -Infinity;
  let bottom = -Infinity;
  for (const selector of BOARD_PARTS) {
    const el = root.querySelector(selector);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    left = Math.min(left, r.left);
    top = Math.min(top, r.top);
    right = Math.max(right, r.right);
    bottom = Math.max(bottom, r.bottom);
  }
  const board: Rect =
    left === Infinity
      ? { left: 0, top: 0, width: 0, height: 0 }
      : {
          left: left - layerBox.left,
          top: top - layerBox.top,
          width: right - left,
          height: bottom - top,
        };
  const masthead = root.querySelector('.masthead')?.getBoundingClientRect();
  // The masthead is the ceiling and the footer is the floor: the dead
  // drift in the margins, never over the marque and never over the
  // credits. Both are viewport relative, like the layer box.
  const footer = root.querySelector('.footer')?.getBoundingClientRect();
  const floor = footer
    ? Math.min(window.innerHeight, footer.top - 4)
    : window.innerHeight;
  return {
    bounds: {
      left: -layerBox.left,
      top: -layerBox.top,
      width: window.innerWidth,
      height: floor,
    },
    board,
    ceiling: masthead ? masthead.bottom - layerBox.top : -layerBox.top,
    ghost: { width: GHOST_WIDTH, height: GHOST_HEIGHT },
  };
}

export function Haunt({
  spent,
  currentPlayCount,
  reducedMotion,
  births,
}: HauntProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const [geo, setGeo] = useState<HauntGeometry | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const bump = () => setTick((t) => t + 1);
    window.addEventListener('resize', bump);
    // The display face lands after first paint and shifts the masthead;
    // re-measure once the real metrics are in.
    document.fonts?.ready.then(bump, () => {});
    return () => window.removeEventListener('resize', bump);
  }, []);

  useLayoutEffect(() => {
    const layer = layerRef.current;
    if (!layer) return;
    const next = measure(layer);
    setGeo((prev) =>
      prev &&
      sameRect(prev.bounds, next.bounds) &&
      sameRect(prev.board, next.board) &&
      prev.ceiling === next.ceiling
        ? prev
        : next,
    );
  }, [spent.length, currentPlayCount, tick]);

  const placements = geo ? layoutHaunt(spent, currentPlayCount, geo) : [];

  // Hand each newest ghost the tile it rose from, letter by letter.
  const cradle = new Map<string, GhostBirth[]>();
  if (births && !reducedMotion) {
    for (const b of births.at) {
      const list = cradle.get(b.letter) ?? [];
      list.push(b);
      cradle.set(b.letter, list);
    }
  }

  return (
    <div
      className="haunt"
      data-testid="haunt"
      ref={layerRef}
      role="group"
      aria-label="Spent letters"
    >
      {placements.map((p) => {
        const birth =
          births && p.playIndex === births.playIndex
            ? cradle.get(p.letter)?.shift()
            : undefined;
        const style: CSSProperties = {
          width: GHOST_WIDTH,
          height: GHOST_HEIGHT,
          transform: `translate(${p.x}px, ${p.y}px) scale(${p.scale})`,
          opacity: p.opacity,
        };
        if (birth) {
          Object.assign(style, {
            '--birth-x': `${birth.x}px`,
            '--birth-y': `${birth.y}px`,
          });
        }
        return (
          <span
            key={p.ordinal}
            className="haunt-ghost"
            data-testid="ghost"
            data-play-index={p.playIndex}
            data-motion={reducedMotion ? 'off' : 'on'}
            data-arriving={birth ? '' : undefined}
            style={style}
          >
            <span
              className="ghost-wander"
              style={{
                animationDuration: `${p.wander.duration}ms`,
                animationDelay: `${p.wander.delay}ms`,
              }}
            >
              <span
                className="ghost-bob"
                style={
                  {
                    animationDuration: `${p.bob.duration}ms`,
                    animationDelay: `${p.bob.delay}ms`,
                    '--blink-duration': `${p.blink.duration}ms`,
                    '--blink-delay': `${p.blink.delay}ms`,
                  } as CSSProperties
                }
              >
                <span className="ghost-body" aria-hidden="true" />
                <span className="ghost-letter">{p.letter.toUpperCase()}</span>
              </span>
            </span>
          </span>
        );
      })}
    </div>
  );
}
