import { describe, expect, it } from 'vitest';
import { rankFor, RANK_TIERS } from '../src/game/rank';
import { advanceStreak } from '../src/game/streak';
import { buildShare } from '../src/game/share';
import {
  loadRunSnapshot,
  saveRunSnapshot,
  memoryStorage,
} from '../src/game/persistence';

describe('rank', () => {
  it('grades score as a fraction of par with a capped top tier', () => {
    expect(rankFor(85, 85).name).toBe(RANK_TIERS[0]!.name);
    expect(rankFor(95, 85).name).toBe(RANK_TIERS[0]!.name);
    expect(rankFor(95, 85).fraction).toBeGreaterThan(1);
    expect(rankFor(0, 85).name).toBe(RANK_TIERS[RANK_TIERS.length - 1]!.name);
    expect(rankFor(60, 85).fraction).toBeCloseTo(60 / 85);
  });

  it('tiers descend monotonically', () => {
    for (let i = 1; i < RANK_TIERS.length; i++) {
      expect(RANK_TIERS[i]!.min).toBeLessThan(RANK_TIERS[i - 1]!.min);
    }
  });
});

describe('streak', () => {
  it('starts, continues on consecutive days, and is idempotent within a day', () => {
    const day1 = advanceStreak(undefined, 100);
    expect(day1).toEqual({ lastDayIndex: 100, length: 1 });
    expect(advanceStreak(day1, 101)).toEqual({ lastDayIndex: 101, length: 2 });
    expect(advanceStreak(day1, 100)).toEqual(day1);
  });

  it('a missed day resets to one', () => {
    expect(advanceStreak({ lastDayIndex: 100, length: 9 }, 103)).toEqual({
      lastDayIndex: 103,
      length: 1,
    });
  });
});

describe('share', () => {
  const share = buildShare({
    title: 'Out of Sorts, Day 12',
    words: [
      { word: 'triangle', length: 8, score: 9 },
      { word: 'relating', length: 8, score: 9 },
      { word: 'alerting', length: 8, score: 9 },
      { word: 'tearing', length: 7, score: 8 },
      { word: 'rating', length: 6, score: 7 },
      { word: 'grin', length: 4, score: 5 },
      { word: 'rig', length: 3, score: 4 },
    ],
    rackSize: 8,
    cleanDescent: false,
    allEights: { found: 3, total: 3 },
    rank: { name: 'Haunting', fraction: 0.91 },
  });

  it('draws the stack shape: one row per word, width by length', () => {
    const rows = share.split('\n').filter((l) => l.includes('█'));
    expect(rows).toHaveLength(7);
    expect(rows[0]).toContain('█'.repeat(8));
    expect(rows[4]!.replace(/[^█]/g, '')).toHaveLength(6);
  });

  it('marks a notch where more than one letter dropped', () => {
    const rows = share.split('\n').filter((l) => l.includes('█'));
    // rating (6) to grin (4) drops two letters: notch
    expect(rows[5]).toContain('▼');
    expect(rows[4]).not.toContain('▼');
  });

  it('is spoiler-free: no played word appears', () => {
    for (const w of ['triangle', 'relating', 'tearing', 'grin']) {
      expect(share.toLowerCase()).not.toContain(w);
    }
  });

  it('carries the three badges as a line', () => {
    expect(share).toContain('All Eights 3/3');
    expect(share).toContain('Haunting');
    expect(share).not.toContain('Clean Descent ✓');
  });

  it('omits the all eights line on a single-eight rack', () => {
    const single = buildShare({
      title: 'Out of Sorts, Day 13',
      words: [{ word: 'sparrows', length: 8, score: 13 }],
      rackSize: 8,
      cleanDescent: false,
      allEights: null,
      rank: { name: 'Faint', fraction: 0.1 },
    });
    expect(single).not.toContain('All Eights');
  });
});

describe('run persistence', () => {
  it('saves and restores independent snapshots per key', () => {
    const storage = memoryStorage();
    saveRunSnapshot(storage, 'daily-212', {
      rack: 'aegilnrt',
      words: ['triangle', 'tearing'],
      stopped: false,
    });
    saveRunSnapshot(storage, 'endless-current', {
      rack: 'aoprrssw',
      words: ['sparrows'],
      stopped: true,
      endlessSeed: 4,
    });
    expect(loadRunSnapshot(storage, 'daily-212')?.words).toEqual([
      'triangle',
      'tearing',
    ]);
    expect(loadRunSnapshot(storage, 'endless-current')?.endlessSeed).toBe(4);
    expect(loadRunSnapshot(storage, 'daily-999')).toBeNull();
  });

  it('survives corrupt storage gracefully', () => {
    const storage = memoryStorage();
    storage.setItem('oos:daily-1', '{not json');
    expect(loadRunSnapshot(storage, 'daily-1')).toBeNull();
  });
});
