import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { Solver } from '../src/engine/solver';
import { scrambleRack } from '../src/engine/engine';
import { toSignature } from '../src/engine/signature';
import type { Calendar } from '../src/calendar/types';
import { realDicts } from './helpers/dicts';

// Walks the whole committed calendar. These tests pin the game's central
// promise (every daily is perfectible) and the scramble hole closed by
// baking the eights list.
const calendar: Calendar = JSON.parse(
  readFileSync('public/data/calendar.json', 'utf8'),
);

describe('the committed calendar', () => {
  const dicts = realDicts();

  it('has roughly the expected number of entries', () => {
    expect(calendar.entries.length).toBeGreaterThan(2500);
    expect(calendar.entries.length).toBeLessThan(3300);
  });

  it('every rack passes the gate: every daily is perfectible', () => {
    const solver = new Solver(dicts.commonIndex, 'mill');
    for (const entry of calendar.entries) {
      expect(solver.solveRack(entry.rack).bestClean, entry.rack).not.toBeNull();
    }
  });

  it('contains no duplicate racks', () => {
    const sigs = new Set(calendar.entries.map((e) => e.rack));
    expect(sigs.size).toBe(calendar.entries.length);
  });

  it('shares no rack with the peach calendar', () => {
    const peach = JSON.parse(
      readFileSync('data/peach-exclusions.json', 'utf8'),
    ) as { words: string[] };
    expect(peach.words).toHaveLength(544);
    const peachSigs = new Set(peach.words.map(toSignature));
    for (const entry of calendar.entries) {
      expect(peachSigs.has(entry.rack), entry.rack).toBe(false);
    }
  });

  it('every eights list is complete against the boundary and nothing else', () => {
    for (const entry of calendar.entries) {
      const expected = dicts.boundaryIndex.get(entry.rack) ?? [];
      expect(entry.eights, entry.rack).toEqual(expected);
      expect(entry.eights.length).toBeGreaterThanOrEqual(1);
    }
  });

  it('contains no denied word anywhere in any eights list', () => {
    const deny = new Set(
      (
        JSON.parse(readFileSync('data/denylist.json', 'utf8')) as {
          words: string[];
        }
      ).words,
    );
    for (const entry of calendar.entries) {
      for (const w of entry.eights) expect(deny.has(w), w).toBe(false);
    }
  });

  it('scrambleRack fed the eights list never displays a valid word', () => {
    // The cold-start hole, closed: the forbidden predicate needs no
    // dictionary, only the baked list. Exercise the multi-eight entries
    // hard since they are the ones that could leak a free word.
    const multi = calendar.entries.filter((e) => e.eights.length >= 2);
    expect(multi.length).toBeGreaterThan(0);
    for (const entry of multi) {
      for (let seed = 0; seed < 25; seed++) {
        const display = scrambleRack(entry.rack, seed, (d) =>
          entry.eights.includes(d),
        );
        expect(entry.eights.includes(display)).toBe(false);
        expect(toSignature(display)).toBe(entry.rack);
      }
    }
  });

  it('spreads S racks and multi-eight racks rather than clustering them', () => {
    let run = 0;
    let longest = 0;
    let last: boolean | null = null;
    for (const e of calendar.entries) {
      const s = e.rack.includes('s');
      run = s === last ? run + 1 : 1;
      last = s;
      longest = Math.max(longest, run);
    }
    expect(longest).toBeLessThanOrEqual(4);
    const multiPositions = calendar.entries
      .map((e, i) => ({ e, i }))
      .filter(({ e }) => e.eights.length >= 2)
      .map(({ i }) => i);
    const gaps = multiPositions.slice(1).map((p, k) => p - multiPositions[k]!);
    expect(Math.max(...gaps)).toBeLessThanOrEqual(60);
  });
});
