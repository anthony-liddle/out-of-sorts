import { describe, expect, it } from 'vitest';
import { rankFor, RANK_TIERS } from '../src/game/rank';
import {
  advanceStreak,
  currentStreak,
  streakSurvivesTo,
} from '../src/game/streak';
import { buildShare, formatShareDate } from '../src/game/share';
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

  it('ascends from barely-there to at peace: faint up to at rest', () => {
    expect(rankFor(0, 85).name).toBe('Faint');
    expect(rankFor(85, 85).name).toBe('At Rest');
    expect(RANK_TIERS.map((t) => t.name)).toEqual([
      'At Rest',
      'Haunting',
      'Gliding',
      'Drifting',
      'Stirring',
      'Faint',
    ]);
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

describe('the displayed streak is derived, never read', () => {
  // A stored record is not a live streak. It is a record of the last day
  // played, and whether it is still alive is a question about TODAY.
  const stored = { lastDayIndex: 100, length: 3 };

  it('played today: alive, shows its length', () => {
    expect(currentStreak(stored, 100)).toBe(3);
  });

  it('played yesterday: alive. The streak is not lost until the day is', () => {
    expect(currentStreak(stored, 101)).toBe(3);
  });

  it('played two days ago: broken, shows nothing', () => {
    expect(currentStreak(stored, 102)).toBe(0);
  });

  it('played five days ago: broken, shows nothing', () => {
    expect(currentStreak(stored, 105)).toBe(0);
  });

  it('no record at all is zero, not a crash', () => {
    expect(currentStreak(undefined, 100)).toBe(0);
  });

  /**
   * THE BUG, PINNED HARDEST. The display read `.length` raw while
   * advancement asked whether the streak had survived, so a dead streak
   * printed its corpse until you played, and playing "reset" it. The game
   * appeared to punish you for playing.
   *
   * Asserted on the derived value rather than the rendered header: the
   * defect lives in the value, and a DOM assertion changes meaning when the
   * display guard changes.
   */
  it('finishing a run never lowers the displayed streak', () => {
    for (const gap of [2, 3, 5, 30, 365]) {
      const today = stored.lastDayIndex + gap;
      const before = currentStreak(stored, today);
      const after = currentStreak(advanceStreak(stored, today), today);
      expect(before).toBe(0);
      expect(after).toBe(1);
      expect(after).toBeGreaterThanOrEqual(before);
    }
  });

  it('and it never lowers it on a live streak either', () => {
    for (const gap of [0, 1]) {
      const today = stored.lastDayIndex + gap;
      const before = currentStreak(stored, today);
      const after = currentStreak(advanceStreak(stored, today), today);
      expect(after).toBeGreaterThanOrEqual(before);
    }
  });

  /**
   * The actual defect was two places reasoning about "is this streak alive"
   * and only one of them doing it. Pin that they cannot drift apart again:
   * over every gap, a streak the display calls dead must be one advancement
   * restarts at 1, and a streak the display calls alive must be one
   * advancement builds on.
   */
  it('display and advancement agree about aliveness at every gap', () => {
    for (let gap = 0; gap <= 40; gap++) {
      const today = stored.lastDayIndex + gap;
      const displayedAlive = currentStreak(stored, today) > 0;
      const advanced = advanceStreak(stored, today);
      const advancementAlive = advanced.length > 1 || gap === 0;
      expect(displayedAlive).toBe(advancementAlive);
      expect(displayedAlive).toBe(streakSurvivesTo(stored, today));
    }
  });
});

describe('the share date', () => {
  it('reads as a month and a day, with no year', () => {
    expect(formatShareDate(new Date(2026, 6, 14))).toBe('July 14');
  });

  it('does not pad the day', () => {
    expect(formatShareDate(new Date(2026, 0, 3))).toBe('January 3');
  });

  /**
   * The rack is chosen from LOCAL year/month/day. A date formatted through
   * UTC names a different day for anyone east or west of it near midnight,
   * which is the share claiming a rack the player never saw.
   */
  it('is built from local components, not UTC', () => {
    // 23:30 local on the 14th. Under any UTC-derived formatting in a
    // timezone ahead of UTC this reads as the 14th; behind it, the 15th.
    const lateEvening = new Date(2026, 6, 14, 23, 30);
    expect(formatShareDate(lateEvening)).toBe('July 14');
    const earlyMorning = new Date(2026, 6, 14, 0, 30);
    expect(formatShareDate(earlyMorning)).toBe('July 14');
  });

  it('names every month', () => {
    const names = Array.from({ length: 12 }, (_, m) =>
      formatShareDate(new Date(2026, m, 1)),
    );
    expect(names).toEqual([
      'January 1',
      'February 1',
      'March 1',
      'April 1',
      'May 1',
      'June 1',
      'July 1',
      'August 1',
      'September 1',
      'October 1',
      'November 1',
      'December 1',
    ]);
  });
});

describe('share', () => {
  const share = buildShare({
    title: 'Out of Sorts · Day 12',
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
    spentCount: 5,
    cleanDescent: false,
    allEights: { found: 3, total: 3 },
    rank: { name: 'Haunting', fraction: 0.91 },
    score: 49,
    par: 54,
  });

  it('draws the stack shape: one row per word, width by length', () => {
    const rows = share.split('\n').filter((l) => l.includes('█'));
    expect(rows).toHaveLength(7);
    expect(rows[0]).toContain('█'.repeat(8));
    expect(rows[4]!.replace(/[^█]/g, '')).toHaveLength(6);
  });

  it('draws pure blocks: the notch is the width gap, not a glyph', () => {
    const rows = share.split('\n').filter((l) => l.includes('█'));
    for (const row of rows) {
      expect(row.replace(/█/g, '').trim()).toBe('');
    }
  });

  it('carries one ghost per spent letter', () => {
    const ghostLine = share.split('\n').find((l) => l.includes('👻'));
    expect(ghostLine).toBeDefined();
    expect([...ghostLine!].filter((c) => c === '👻')).toHaveLength(5);
  });

  it('states the score against par in the badge line', () => {
    expect(share).toContain('49 of par 54');
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
      title: 'Out of Sorts · Day 13',
      words: [{ word: 'sparrows', length: 8, score: 13 }],
      rackSize: 8,
      spentCount: 0,
      cleanDescent: false,
      allEights: null,
      rank: { name: 'Faint', fraction: 0.1 },
      score: 13,
      par: 130,
    });
    expect(single).not.toContain('All Eights');
    expect(single).not.toContain('👻');
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
