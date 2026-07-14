// The haunting, as pure geometry. Spent letters colonize the margins around
// the board: the sky above the pool, the wings beside the board where the
// viewport is wide enough, the ground below the stop. Age comes from the
// engine's play index and is never computed here beyond reading it; the
// newest ghost sits at the board's edge and every play pushes the older
// dead further out and dimmer, but none of them ever leave.
//
// Everything is a pure function of the spent letters and the measured
// geometry, seeded per letter and play index, so the same run renders the
// same haunt on every mount and a reload never reshuffles the dead.
import { hashString, mulberry32 } from '../engine/prng';
import type { SpentLetter } from '../engine/run';

export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface HauntGeometry {
  /** The area ghosts may occupy, in the same coordinates as everything
   * else. Typically the viewport, expressed relative to the haunt layer. */
  bounds: Rect;
  /** The union of the pool, the input, the controls, and the stack. Ghosts
   * never intersect it. */
  board: Rect;
  /** Sky starts below this y (the masthead's bottom edge). */
  ceiling: number;
  ghost: { width: number; height: number };
}

export interface GhostMotion {
  duration: number;
  delay: number;
}

export interface GhostPlacement {
  letter: string;
  playIndex: number;
  /** Position in the spent list; part of the seed, so two ghosts of the
   * same letter from the same play still land apart. */
  ordinal: number;
  x: number;
  y: number;
  scale: number;
  opacity: number;
  bob: GhostMotion;
  wander: GhostMotion;
  blink: GhostMotion;
}

/** Base ghost box in px; scale only ever shrinks it, so the box is the
 * conservative bound the keep out math uses. */
export const GHOST_WIDTH = 34;
export const GHOST_HEIGHT = 38;

/** Breathing room between the board and the nearest ghost. */
const PAD = 6;

/** How much of a zone's depth an age step consumes: 1 - 0.8^age. */
const OUTWARD = 0.8;

interface Zone {
  axis: 'up' | 'down' | 'left' | 'right';
  /** Radial travel available beyond the near edge. */
  depth: number;
  /** Cross axis range for the ghost's leading edge. */
  crossMin: number;
  crossMax: number;
}

function zones(geo: HauntGeometry): Zone[] {
  const { bounds, board, ceiling, ghost } = geo;
  const right = bounds.left + bounds.width;
  const bottom = bounds.top + bounds.height;
  const boardRight = board.left + board.width;
  const boardBottom = board.top + board.height;

  // Cross axes clamp to the board's own span: a ghost drifting past the
  // board's corner would be radially near yet diagonally far, and the age
  // ordering (newest nearest) would stop being true.
  const skyCrossMin = Math.max(board.left, bounds.left);
  const skyCrossMax = Math.min(boardRight, right) - ghost.width;
  const wingCrossMin = Math.max(board.top, bounds.top);
  const wingCrossMax = Math.min(boardBottom, bottom) - ghost.height;

  const all: Zone[] = [
    {
      axis: 'up',
      depth: board.top - PAD - ghost.height - Math.max(bounds.top, ceiling),
      crossMin: skyCrossMin,
      crossMax: skyCrossMax,
    },
    {
      axis: 'down',
      depth: bottom - (boardBottom + PAD) - ghost.height,
      crossMin: skyCrossMin,
      crossMax: skyCrossMax,
    },
    {
      axis: 'left',
      depth: board.left - PAD - ghost.width - bounds.left,
      crossMin: wingCrossMin,
      crossMax: wingCrossMax,
    },
    {
      axis: 'right',
      depth: right - (boardRight + PAD) - ghost.width,
      crossMin: wingCrossMin,
      crossMax: wingCrossMax,
    },
  ];
  return all.filter((z) => z.depth >= 0 && z.crossMax >= z.crossMin);
}

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(Math.max(v, lo), hi);
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Radial offset jitter, sized so the newest ghosts are always strictly
 * nearer the board than every older one, at any zone depth. */
function jitter(age: number, depth: number, r: number): number {
  if (age === 0) return r * Math.min(3, 0.04 * depth);
  if (age === 1) return (r - 0.5) * 2 * Math.min(4, 0.05 * depth);
  return (r - 0.5) * 2 * Math.min(24, 0.12 * depth);
}

/** Breathing room between twins in one drop. */
const TWIN_GAP = 6;

export function layoutHaunt(
  spent: readonly SpentLetter[],
  currentPlayCount: number,
  geo: HauntGeometry,
): GhostPlacement[] {
  const free = zones(geo);
  const lastPlay = currentPlayCount - 1;

  // One placement per PLAY, not per letter. A multi letter drop is one
  // sacrifice: its ghosts share an age, so they share a distance, a zone,
  // and a set of clocks, and sit side by side. Two ghosts of the same age
  // are a notch; the drift is the Clean Descent told from the other side.
  const groups = new Map<number, { letter: string; ordinal: number }[]>();
  spent.forEach((s, ordinal) => {
    const list = groups.get(s.playIndex) ?? [];
    list.push({ letter: s.letter, ordinal });
    groups.set(s.playIndex, list);
  });

  const byOrdinal = new Map<number, GhostPlacement>();
  for (const [playIndex, members] of groups) {
    const letters = members.map((m) => m.letter).join('');
    const rng = mulberry32(hashString(`${playIndex}:${letters}`));
    const rZone = rng();
    const rCross = rng();
    const rJitter = rng();
    const rBobDuration = rng();
    const rBobDelay = rng();
    const rWanderDuration = rng();
    const rWanderDelay = rng();
    const rBlinkDuration = rng();
    const rBlinkDelay = rng();

    const age = lastPlay - playIndex;
    const reach = 1 - Math.pow(OUTWARD, age);
    const opacity = Math.round((0.18 + 0.77 * Math.pow(0.86, age)) * 1e4) / 1e4;
    const scale = Math.round((0.72 + 0.28 * Math.pow(0.86, age)) * 1e3) / 1e3;

    const step = geo.ghost.width + TWIN_GAP;
    const span = geo.ghost.width + (members.length - 1) * step;

    const bobDuration = Math.round(4800 + rBobDuration * 2600);
    const wanderDuration = Math.round(14000 + rWanderDuration * 8000);
    const blinkDuration = Math.round(6000 + rBlinkDuration * 7000);
    const bob = {
      duration: bobDuration,
      delay: -Math.round(rBobDelay * bobDuration),
    };
    const wander = {
      duration: wanderDuration,
      delay: -Math.round(rWanderDelay * wanderDuration),
    };
    const blink = {
      duration: blinkDuration,
      delay: Math.round(rBlinkDelay * blinkDuration),
    };

    const place = (i: number, x: number, y: number): void => {
      const m = members[i]!;
      byOrdinal.set(m.ordinal, {
        letter: m.letter,
        playIndex,
        ordinal: m.ordinal,
        x: round(x),
        y: round(y),
        scale,
        opacity,
        bob,
        wander,
        blink,
      });
    };

    // Zones that can hold the whole group along their cross axis; when
    // none can (a five letter drop in a sliver), take the roomiest and let
    // the twins crowd rather than leave the bounds.
    const fitting = free.filter(
      (z) => z.crossMax - z.crossMin >= span - geo.ghost.width,
    );
    const candidates = fitting.length > 0 ? fitting : free;

    if (candidates.length === 0) {
      // Degenerate geometry (nothing measured yet, or no room anywhere):
      // hold the invariant that ghosts never sit on the board by floating
      // them above it, still deterministically.
      for (let i = 0; i < members.length; i++) {
        place(
          i,
          geo.board.left + i * step,
          geo.board.top - PAD - geo.ghost.height - reach * 60 - rJitter * 3,
        );
      }
      continue;
    }

    const weights = candidates.map(
      (z) => (z.depth + 1) * (z.crossMax - z.crossMin + 1),
    );
    const totalWeight = weights.reduce((a, b) => a + b, 0);
    let pick = rZone * totalWeight;
    let zone = candidates[0]!;
    for (let i = 0; i < candidates.length; i++) {
      pick -= weights[i]!;
      if (pick <= 0) {
        zone = candidates[i]!;
        break;
      }
    }

    const dist = clamp(
      reach * zone.depth + jitter(age, zone.depth, rJitter),
      0,
      zone.depth,
    );
    const crossRange = Math.max(
      0,
      zone.crossMax - zone.crossMin - (span - geo.ghost.width),
    );
    const crossStart = zone.crossMin + rCross * crossRange;
    const boardRight = geo.board.left + geo.board.width;
    const boardBottom = geo.board.top + geo.board.height;

    for (let i = 0; i < members.length; i++) {
      const cross = clamp(crossStart + i * step, zone.crossMin, zone.crossMax);
      switch (zone.axis) {
        case 'up':
          place(i, cross, geo.board.top - PAD - geo.ghost.height - dist);
          break;
        case 'down':
          place(i, cross, boardBottom + PAD + dist);
          break;
        case 'left':
          place(i, geo.board.left - PAD - geo.ghost.width - dist, cross);
          break;
        case 'right':
          place(i, boardRight + PAD + dist, cross);
          break;
      }
    }
  }

  return spent.map((_, ordinal) => byOrdinal.get(ordinal)!);
}
