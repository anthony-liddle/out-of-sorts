import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';
import { rackForDate } from '../src/calendar/day';
import { localDaysBetween } from '../src/calendar/epochs';
import type { Calendar } from '../src/calendar/types';

// THE COMMITTED ARTIFACT, NOT A SYNTHETIC ONE. Every other calendar test
// builds its own calendar with its own epoch, so the shipped epoch could be
// any value at all and they would all still pass. That is exactly what
// happened: the epoch sat in the future, rackForDate returned null every
// day, the UI quietly served entry 0, and 150 tests said nothing.
const calendar: Calendar = JSON.parse(
  readFileSync('public/data/calendar.json', 'utf8'),
);

const at = (offsetDays: number): Date => {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d;
};

describe("today's daily, against the shipped calendar", () => {
  it('has a rack for today', () => {
    const today = rackForDate(calendar, new Date());
    expect(today).not.toBeNull();
    expect(today!.rack).toHaveLength(8);
    expect(today!.eights.length).toBeGreaterThanOrEqual(1);
  });

  it('is not the same rack tomorrow', () => {
    expect(rackForDate(calendar, at(1))!.rack).not.toBe(
      rackForDate(calendar, new Date())!.rack,
    );
  });

  it('is not the same rack the day after tomorrow either', () => {
    const days = [0, 1, 2].map((n) => rackForDate(calendar, at(n))!.rack);
    expect(new Set(days).size).toBe(3);
  });

  it('returns null before the epoch, rather than a plausible wrong rack', () => {
    // The epoch is today, so yesterday is before the game existed. Null is
    // the correct answer, and the caller must surface it: the original bug
    // was not this guard, it was the UI clamping past it to entry 0.
    expect(rackForDate(calendar, at(-1))).toBeNull();
  });

  it('has a rack for every day from the epoch through thirty days out', () => {
    const epochOffset = -localDaysBetween(calendar.epoch, new Date());
    for (let i = epochOffset; i <= 30; i++) {
      const entry = rackForDate(calendar, at(i));
      expect(entry, `day offset ${i}`).not.toBeNull();
      expect(entry!.rack).toHaveLength(8);
    }
  });

  it('starts today or earlier: an epoch in the future is the bug', () => {
    expect(localDaysBetween(calendar.epoch, new Date())).toBeGreaterThanOrEqual(
      0,
    );
  });
});
