import { mulberry32, seededShuffle } from '../engine/prng';
import { localDaysBetween } from './epochs';
import type { Calendar, CalendarEntry } from './types';

// Rollover is local midnight: the day function depends only on the local
// calendar date, so a timezone change within the same local day never
// changes the rack.

const CYCLE_SEED = 0x0c0ffee;

/** Entry order for a cycle. Cycle 0 is the committed order, untouched.
 * Later cycles are deterministic reshuffles, adjusted so the first rack of
 * a cycle never equals the last rack of the cycle before it. */
function cycleOrder(n: number, cycle: number): number[] {
  if (cycle === 0) return Array.from({ length: n }, (_, i) => i);
  const order = seededShuffle(
    Array.from({ length: n }, (_, i) => i),
    CYCLE_SEED ^ Math.imul(cycle, 0x9e3779b1),
  );
  const prevLast = cycleOrder(n, cycle - 1)[n - 1]!;
  if (order[0] === prevLast && n > 1) {
    [order[0], order[1]] = [order[1]!, order[0]!];
  }
  return order;
}

export function entryForDayIndex(
  calendar: Calendar,
  dayIndex: number,
): CalendarEntry {
  const n = calendar.entries.length;
  const cycle = Math.floor(dayIndex / n);
  const pos = dayIndex % n;
  return calendar.entries[cycleOrder(n, cycle)[pos]!]!;
}

/** The rack for a date, or null before the calendar epoch. Pure function of
 * the local date and the committed calendar; no backend, no network. */
export function rackForDate(
  calendar: Calendar,
  date: Date,
): CalendarEntry | null {
  const dayIndex = localDaysBetween(calendar.epoch, date);
  if (dayIndex < 0) return null;
  return entryForDayIndex(calendar, dayIndex);
}

export { mulberry32 };
