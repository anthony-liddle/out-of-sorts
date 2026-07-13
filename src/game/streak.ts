// The daily streak. Quiet, never naggy, local only. Keyed to storage day
// indexes (days since STORAGE_EPOCH), so it survives any calendar
// re-anchoring. Endless never calls this.
export interface Streak {
  lastDayIndex: number;
  length: number;
}

/** Advance the streak for a completed daily. Idempotent within a day. */
export function advanceStreak(
  current: Streak | undefined,
  dayIndex: number,
): Streak {
  if (!current) return { lastDayIndex: dayIndex, length: 1 };
  if (current.lastDayIndex === dayIndex) return current;
  if (current.lastDayIndex === dayIndex - 1) {
    return { lastDayIndex: dayIndex, length: current.length + 1 };
  }
  return { lastDayIndex: dayIndex, length: 1 };
}
