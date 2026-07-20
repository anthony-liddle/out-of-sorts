// The daily streak. Quiet, never naggy, local only. Keyed to storage day
// indexes (days since STORAGE_EPOCH), so it survives any calendar
// re-anchoring. Endless never calls this.
export interface Streak {
  lastDayIndex: number;
  length: number;
}

/**
 * Is a stored record still a live streak on `dayIndex`?
 *
 * THE ONE PLACE THIS QUESTION IS ASKED. Both the display and the
 * advancement call it, and neither re-derives it. When they each answered
 * separately, only advancement actually asked: the display read `.length`
 * raw, so a streak that died on day 8 still printed 3 on day 9, and
 * finishing that day's run "reset" it to 1. The number was a symptom. Two
 * places reasoning about the same fact was the defect.
 *
 * Played yesterday counts as alive: today is not over, so nothing is lost
 * yet.
 */
export function streakSurvivesTo(
  current: Streak | undefined,
  dayIndex: number,
): boolean {
  if (!current) return false;
  return (
    current.lastDayIndex === dayIndex || current.lastDayIndex === dayIndex - 1
  );
}

/**
 * The streak to DISPLAY on `todayIndex`. Never render `stored.length`: that
 * is a record of the last day played, not a live count.
 */
export function currentStreak(
  current: Streak | undefined,
  todayIndex: number,
): number {
  return streakSurvivesTo(current, todayIndex) ? current!.length : 0;
}

/** Advance the streak for a completed daily. Idempotent within a day. */
export function advanceStreak(
  current: Streak | undefined,
  dayIndex: number,
): Streak {
  if (!streakSurvivesTo(current, dayIndex)) {
    return { lastDayIndex: dayIndex, length: 1 };
  }
  if (current!.lastDayIndex === dayIndex) return current!;
  return { lastDayIndex: dayIndex, length: current!.length + 1 };
}
