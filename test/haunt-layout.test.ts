// The haunting, as pure geometry. Spent letters scatter into the margins
// around the board: deterministic per letter and play index, aging outward
// and dimming, never on the board itself. The engine owns age (playIndex);
// this function only reads it. The component feeds it measured rects; these
// tests feed it hand built ones, including a twenty ghost load the real
// game cannot produce (a run spends at most rack minus final pool, five),
// because the function must not care.
import { describe, expect, it } from 'vitest';
import type { SpentLetter } from '../src/engine/run';
import {
  GHOST_HEIGHT,
  GHOST_WIDTH,
  layoutHaunt,
  type GhostPlacement,
  type HauntGeometry,
  type Rect,
} from '../src/ui/haunt-layout';

const GHOST = { width: GHOST_WIDTH, height: GHOST_HEIGHT };

/** A phone at 320px: no side margins to speak of, so the dead go up and
 * down. Sky between masthead and pool, ground under the stop button. */
const PHONE_320: HauntGeometry = {
  bounds: { left: 0, top: 0, width: 320, height: 568 },
  board: { left: 8, top: 200, width: 304, height: 280 },
  ceiling: 80,
  ghost: GHOST,
};

const PHONE_375: HauntGeometry = {
  bounds: { left: 0, top: 0, width: 375, height: 812 },
  board: { left: 10, top: 220, width: 355, height: 380 },
  ceiling: 90,
  ghost: GHOST,
};

/** Desktop: the app column sits centered with wide free wings. */
const DESKTOP: HauntGeometry = {
  bounds: { left: -400, top: 0, width: 1280, height: 900 },
  board: { left: 20, top: 200, width: 440, height: 500 },
  ceiling: 90,
  ghost: GHOST,
};

/** Only the sky exists, and it is deep: board flush with the left, right,
 * and bottom edges. Isolates the radial age ordering from zone choice. */
const SKY_ONLY: HauntGeometry = {
  bounds: { left: 0, top: 0, width: 375, height: 1200 },
  board: { left: 0, top: 560, width: 375, height: 640 },
  ceiling: 40,
  ghost: GHOST,
};

const GEOMETRIES = [PHONE_320, PHONE_375, DESKTOP, SKY_ONLY];

/** A full real run: five drops is the maximum the engine allows (eight
 * letters down to a final pool of three). */
const REAL_RUN: SpentLetter[] = [
  { letter: 'u', playIndex: 1 },
  { letter: 'i', playIndex: 2 },
  { letter: 'n', playIndex: 2 },
  { letter: 't', playIndex: 3 },
  { letter: 's', playIndex: 4 },
];
const REAL_PLAYS = 5;

/** Twenty ghosts, beyond anything a run can produce. */
const TWENTY: SpentLetter[] = Array.from({ length: 20 }, (_, i) => ({
  letter: 'aeioubcdfghjklmnpqrs'[i]!,
  playIndex: Math.floor(i / 2),
}));
const TWENTY_PLAYS = 10;

function box(p: GhostPlacement): Rect {
  return { left: p.x, top: p.y, width: GHOST.width, height: GHOST.height };
}

function intersects(a: Rect, b: Rect): boolean {
  return (
    a.left < b.left + b.width &&
    b.left < a.left + a.width &&
    a.top < b.top + b.height &&
    b.top < a.top + a.height
  );
}

/** Shortest distance between two boxes, zero when they touch or overlap. */
function distance(a: Rect, b: Rect): number {
  const dx = Math.max(
    b.left - (a.left + a.width),
    a.left - (b.left + b.width),
    0,
  );
  const dy = Math.max(
    b.top - (a.top + a.height),
    a.top - (b.top + b.height),
    0,
  );
  return Math.hypot(dx, dy);
}

describe('the haunt layout is deterministic', () => {
  it('renders the same run to the same layout, call after call', () => {
    for (const geo of GEOMETRIES) {
      const first = layoutHaunt(REAL_RUN, REAL_PLAYS, geo);
      const second = layoutHaunt([...REAL_RUN], REAL_PLAYS, geo);
      expect(second).toEqual(first);
    }
  });

  it('does not depend on anything but its inputs', () => {
    const a = layoutHaunt(TWENTY, TWENTY_PLAYS, DESKTOP);
    const b = layoutHaunt(TWENTY, TWENTY_PLAYS, DESKTOP);
    expect(b).toEqual(a);
  });
});

describe('one ghost per spent letter, exactly', () => {
  it('returns as many placements as letters, in spent order', () => {
    expect(layoutHaunt([], 0, PHONE_375)).toEqual([]);
    const placed = layoutHaunt(TWENTY, TWENTY_PLAYS, PHONE_375);
    expect(placed).toHaveLength(20);
    expect(placed.map((p) => p.letter)).toEqual(TWENTY.map((s) => s.letter));
    expect(placed.map((p) => p.playIndex)).toEqual(
      TWENTY.map((s) => s.playIndex),
    );
  });
});

describe('age comes from the engine and only dims', () => {
  it('opacity is strictly monotonic in play index: older is fainter, always', () => {
    const placed = layoutHaunt(TWENTY, TWENTY_PLAYS, PHONE_375);
    const byPlay = new Map<number, number>();
    for (const p of placed) {
      const seen = byPlay.get(p.playIndex);
      if (seen !== undefined) expect(p.opacity).toBe(seen);
      byPlay.set(p.playIndex, p.opacity);
    }
    const plays = [...byPlay.keys()].sort((a, b) => a - b);
    for (let i = 1; i < plays.length; i++) {
      expect(byPlay.get(plays[i]!)!).toBeGreaterThan(
        byPlay.get(plays[i - 1]!)!,
      );
    }
  });

  it('never lets the oldest ghost leave: opacity stays visible', () => {
    const ancient: SpentLetter[] = Array.from({ length: 30 }, (_, i) => ({
      letter: 'e',
      playIndex: i,
    }));
    const placed = layoutHaunt(ancient, 30, DESKTOP);
    for (const p of placed) {
      expect(p.opacity).toBeGreaterThan(0.1);
      expect(p.opacity).toBeLessThanOrEqual(1);
    }
  });

  it('the newest is the largest, and size never grows with age', () => {
    const placed = layoutHaunt(TWENTY, TWENTY_PLAYS, DESKTOP);
    const byAge = [...placed].sort((a, b) => b.playIndex - a.playIndex);
    for (let i = 1; i < byAge.length; i++) {
      expect(byAge[i]!.scale).toBeLessThanOrEqual(byAge[i - 1]!.scale);
    }
    expect(byAge[0]!.scale).toBe(1);
    expect(byAge[byAge.length - 1]!.scale).toBeGreaterThan(0.5);
  });
});

describe('ghosts never sit on the board', () => {
  for (const [name, geo] of [
    ['320px', PHONE_320],
    ['375px', PHONE_375],
    ['desktop', DESKTOP],
  ] as const) {
    it(`keeps all twenty ghosts off the board at ${name}`, () => {
      const placed = layoutHaunt(TWENTY, TWENTY_PLAYS, geo);
      for (const p of placed) {
        expect(
          intersects(box(p), geo.board),
          `ghost ${p.letter}#${p.ordinal} at ${p.x},${p.y} sits on the board`,
        ).toBe(false);
      }
    });
  }

  it('keeps all twenty ghosts fully inside the bounds at 320px', () => {
    const placed = layoutHaunt(TWENTY, TWENTY_PLAYS, PHONE_320);
    const b = PHONE_320.bounds;
    for (const p of placed) {
      expect(p.x).toBeGreaterThanOrEqual(b.left);
      expect(p.y).toBeGreaterThanOrEqual(b.top - GHOST.height);
      expect(p.x + GHOST.width).toBeLessThanOrEqual(b.left + b.width);
      expect(p.y + GHOST.height).toBeLessThanOrEqual(b.top + b.height);
    }
  });
});

describe('the scatter is a crowd, not a list', () => {
  it('spreads twenty ghosts over many distinct positions', () => {
    const placed = layoutHaunt(TWENTY, TWENTY_PLAYS, DESKTOP);
    const xs = new Set(placed.map((p) => Math.round(p.x / 8)));
    const ys = new Set(placed.map((p) => Math.round(p.y / 8)));
    expect(xs.size).toBeGreaterThanOrEqual(6);
    expect(ys.size).toBeGreaterThanOrEqual(6);
  });

  it('never lines a real run up in a single row', () => {
    for (const geo of GEOMETRIES) {
      const placed = layoutHaunt(REAL_RUN, REAL_PLAYS, geo);
      const ys = new Set(placed.map((p) => Math.round(p.y)));
      expect(ys.size).toBeGreaterThanOrEqual(3);
    }
  });
});

describe('age pushes the dead outward', () => {
  it('keeps every newest ghost strictly closer to the board than any older one', () => {
    for (const geo of GEOMETRIES) {
      const placed = layoutHaunt(TWENTY, TWENTY_PLAYS, geo);
      const newest = placed.filter((p) => p.playIndex === TWENTY_PLAYS - 1);
      const older = placed.filter((p) => p.playIndex < TWENTY_PLAYS - 1);
      expect(newest.length).toBeGreaterThan(0);
      for (const n of newest) {
        for (const o of older) {
          expect(
            distance(box(n), geo.board),
            `newest ${n.letter} vs older ${o.letter}`,
          ).toBeLessThan(distance(box(o), geo.board));
        }
      }
    }
  });

  it('orders a full real run by age when a single deep zone isolates it', () => {
    const placed = layoutHaunt(REAL_RUN, REAL_PLAYS, SKY_ONLY);
    const byNewest = [...placed].sort((a, b) => b.playIndex - a.playIndex);
    const distances = byNewest.map((p) => distance(box(p), SKY_ONLY.board));
    for (let i = 1; i < distances.length; i++) {
      if (byNewest[i]!.playIndex === byNewest[i - 1]!.playIndex) continue;
      expect(distances[i]!).toBeGreaterThan(distances[i - 1]!);
    }
  });
});

describe('the ghosts breathe on their own clocks', () => {
  it('gives ghosts distinct bob phases so they never pulse in unison', () => {
    const placed = layoutHaunt(TWENTY, TWENTY_PLAYS, DESKTOP);
    const durations = new Set(placed.map((p) => p.bob.duration));
    const delays = new Set(placed.map((p) => p.bob.delay));
    expect(durations.size).toBeGreaterThan(10);
    expect(delays.size).toBeGreaterThan(10);
    for (const p of placed) {
      expect(p.bob.duration).toBeGreaterThan(3000);
      expect(p.bob.delay).toBeLessThanOrEqual(0);
      expect(p.wander.duration).toBeGreaterThan(p.bob.duration);
      expect(p.blink.duration).toBeGreaterThan(3000);
    }
  });
});
