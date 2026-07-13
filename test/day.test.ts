import { describe, expect, it } from 'vitest';
import {
  STORAGE_EPOCH,
  dailyRunKey,
  storageDayIndex,
} from '../src/calendar/epochs';
import { entryForDayIndex, rackForDate } from '../src/calendar/day';
import { endlessEntry } from '../src/calendar/endless';
import type { Calendar, CalendarEntry } from '../src/calendar/types';

function synth(n: number, epoch = '2026-08-01'): Calendar {
  const entries: CalendarEntry[] = [];
  for (let i = 0; i < n; i++) {
    entries.push({ rack: `rack${String(i).padStart(4, '0')}`, eights: ['x'] });
  }
  return { epoch, entries };
}

describe('rackForDate', () => {
  const cal = synth(10);

  it('maps day N to entry N in the first cycle', () => {
    for (let i = 0; i < 10; i++) {
      expect(entryForDayIndex(cal, i)).toEqual(cal.entries[i]);
    }
  });

  it('is deterministic across two independent calls', () => {
    const d = new Date(2026, 7, 5, 14, 30);
    expect(rackForDate(cal, d)).toEqual(rackForDate(cal, d));
  });

  it('uses the local calendar day: same local day, same rack', () => {
    const morning = new Date(2026, 7, 5, 0, 1);
    const night = new Date(2026, 7, 5, 23, 59);
    expect(rackForDate(cal, morning)).toEqual(rackForDate(cal, night));
    const nextDay = new Date(2026, 7, 6, 0, 1);
    expect(rackForDate(cal, nextDay)).not.toEqual(rackForDate(cal, morning));
  });

  it('is a pure function of local date components across timezones', () => {
    const original = process.env.TZ;
    try {
      process.env.TZ = 'Asia/Tokyo';
      const tokyo = rackForDate(cal, new Date(2026, 7, 5, 9, 0));
      process.env.TZ = 'America/New_York';
      const newYork = rackForDate(cal, new Date(2026, 7, 5, 9, 0));
      expect(tokyo).toEqual(newYork);
    } finally {
      process.env.TZ = original;
    }
  });

  it('returns null before the calendar epoch', () => {
    expect(rackForDate(cal, new Date(2026, 6, 31))).toBeNull();
  });

  it('append-only: adding a rack changes no existing first-cycle day', () => {
    // The single most valuable test in this build. Day N is the entry at
    // position N; appending must never re-date a day already promised.
    const before = Array.from({ length: 10 }, (_, i) =>
      entryForDayIndex(cal, i),
    );
    const appended: Calendar = {
      epoch: cal.epoch,
      entries: [...cal.entries, { rack: 'zzznewrk', eights: ['x'] }],
    };
    for (let i = 0; i < 10; i++) {
      expect(entryForDayIndex(appended, i)).toEqual(before[i]);
    }
    expect(entryForDayIndex(appended, 10)).toEqual({
      rack: 'zzznewrk',
      eights: ['x'],
    });
  });

  it('reshuffles later cycles deterministically without a boundary repeat', () => {
    const n = cal.entries.length;
    const cycle1 = Array.from({ length: n }, (_, i) =>
      entryForDayIndex(cal, n + i),
    );
    const again = Array.from({ length: n }, (_, i) =>
      entryForDayIndex(cal, n + i),
    );
    expect(cycle1).toEqual(again);
    expect(new Set(cycle1.map((e) => e.rack)).size).toBe(n);
    expect(cycle1[0]).not.toEqual(entryForDayIndex(cal, n - 1));
    const cycle2First = entryForDayIndex(cal, 2 * n);
    expect(cycle2First).not.toEqual(entryForDayIndex(cal, 2 * n - 1));
  });
});

describe('epochs are decoupled', () => {
  it('storage day index ignores the calendar epoch entirely', () => {
    const d = new Date(2026, 7, 5);
    const idx = storageDayIndex(d);
    const calA = synth(10, '2026-08-01');
    const calB = synth(10, '2026-09-15');
    expect(rackForDate(calA, d)).not.toEqual(rackForDate(calB, d));
    expect(storageDayIndex(d)).toBe(idx);
    expect(dailyRunKey(d)).toBe(`daily-${idx}`);
  });

  it('storage epoch is a fixed constant', () => {
    expect(STORAGE_EPOCH).toBe('2026-01-01');
  });
});

describe('endless', () => {
  const cal = synth(25);

  it('draws deterministically from the calendar pool', () => {
    const a = endlessEntry(cal, 42);
    expect(a).toEqual(endlessEntry(cal, 42));
    expect(cal.entries).toContainEqual(a);
  });

  it('never returns a rack outside the gated calendar', () => {
    const racks = new Set(cal.entries.map((e) => e.rack));
    for (let seed = 0; seed < 200; seed++) {
      expect(racks.has(endlessEntry(cal, seed).rack)).toBe(true);
    }
  });
});
