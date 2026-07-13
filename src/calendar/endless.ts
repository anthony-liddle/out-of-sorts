import { mulberry32 } from '../engine/prng';
import type { Calendar, CalendarEntry } from './types';

/** A fresh rack on demand, drawn from the same gate-surviving calendar
 * pool, so an ungated rack never appears and every Endless run is
 * perfectible too. Deterministic per seed; the caller advances the seed to
 * draw again. Never touches the streak. */
export function endlessEntry(calendar: Calendar, seed: number): CalendarEntry {
  const index = Math.floor(mulberry32(seed)() * calendar.entries.length);
  return calendar.entries[index]!;
}
