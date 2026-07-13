import { describe, expect, it } from 'vitest';
import {
  applyDenylist,
  collapseToRacks,
  excludeSignatures,
  interleave,
  orderEntries,
  runStats,
} from '../scripts/calendar-lib';
import type { CalendarEntry } from '../src/calendar/types';

describe('rack collapse', () => {
  it('anagram seeds collapse to one rack', () => {
    const racks = collapseToRacks([
      'triangle',
      'integral',
      'relating',
      'sparrows',
    ]);
    expect(racks).toEqual(['aegilnrt', 'aoprrssw'].sort());
  });
});

describe('peach exclusion', () => {
  it('removes racks matching any excluded word signature', () => {
    const kept = excludeSignatures(['aegilnrt', 'aoprrssw'], ['triangle']);
    expect(kept).toEqual(['aoprrssw']);
  });

  it('excludes via signature, so an anagram of an excluded word is out too', () => {
    const kept = excludeSignatures(['aegilnrt'], ['relating']);
    expect(kept).toEqual([]);
  });
});

describe('denylist', () => {
  const eights = new Map([
    ['aabcdefg', ['badwordx']],
    ['aegilnrt', ['alerting', 'triangle']],
  ]);
  it('drops a rack whose only eights are all denied', () => {
    const { racks, denied } = applyDenylist(
      ['aabcdefg', 'aegilnrt'],
      eights,
      new Set(['badwordx']),
    );
    expect(racks).toEqual(['aegilnrt']);
    expect(denied).toEqual(['aabcdefg']);
  });

  it('keeps a rack with surviving eights and strips the denied word', () => {
    const { racks, eightsFor } = applyDenylist(
      ['aegilnrt'],
      new Map([['aegilnrt', ['alerting', 'triangle']]]),
      new Set(['alerting']),
    );
    expect(racks).toEqual(['aegilnrt']);
    expect(eightsFor('aegilnrt')).toEqual(['triangle']);
  });
});

describe('ordering', () => {
  it('interleaves two partitions proportionally', () => {
    const merged = interleave(['a1', 'a2', 'a3', 'a4'], ['b1', 'b2']);
    expect(merged).toHaveLength(6);
    expect(merged.filter((x) => x.startsWith('a'))).toHaveLength(4);
    // no run of a longer than ceil(4/2) = 2
    const runs = runStats(merged, (x) => x.startsWith('a'));
    expect(runs.longestTrue).toBeLessThanOrEqual(2);
  });

  it('is deterministic for a fixed seed and avoids long same-S runs', () => {
    const entries: CalendarEntry[] = [];
    for (let i = 0; i < 40; i++) {
      entries.push({
        rack: `abcdefg${i % 2 === 0 ? 's' : 'h'}`,
        eights: ['x'],
      });
    }
    const a = orderEntries(entries, 7);
    const b = orderEntries(entries, 7);
    expect(a).toEqual(b);
    const runs = runStats(a, (e) => e.rack.includes('s'));
    expect(runs.longestTrue).toBeLessThanOrEqual(3);
    expect(runs.longestFalse).toBeLessThanOrEqual(3);
  });
});
