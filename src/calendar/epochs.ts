// The two epochs are DECOUPLED on purpose. Ported from Peach's phase 2,
// where collapsing them into one nearly cost a streak.

/**
 * Keys day-progress and the streak. Streak records are days since this
 * origin. IT NEVER MOVES. MOVING THIS RESETS EVERY PLAYER'S STREAK.
 * A calendar regeneration re-anchors the calendar epoch (in the calendar
 * artifact), never this constant.
 */
export const STORAGE_EPOCH = '2026-01-01';

/** Days between two local calendar dates, DST-safe: local Y/M/D components
 * are mapped to UTC midnights before differencing. */
export function localDaysBetween(epochISO: string, date: Date): number {
  const [y, m, d] = epochISO.split('-').map(Number);
  const epochUTC = Date.UTC(y!, m! - 1, d!);
  const dateUTC = Date.UTC(date.getFullYear(), date.getMonth(), date.getDate());
  return Math.round((dateUTC - epochUTC) / 86400000);
}

/** Days since STORAGE_EPOCH for the local calendar day of `date`. */
export function storageDayIndex(date: Date): number {
  return localDaysBetween(STORAGE_EPOCH, date);
}

/** Storage key for a date's daily run. Independent of the calendar epoch. */
export function dailyRunKey(date: Date): string {
  return `daily-${storageDayIndex(date)}`;
}

/** Endless keeps exactly one in-progress run; starting a new one replaces
 * it. Never touches the streak or any daily key. */
export const ENDLESS_RUN_KEY = 'endless-current';
