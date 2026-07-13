/** One day of Out of Sorts. A rack is eight letters and nothing more; the
 * eights list is every eight-letter boundary word those letters spell (the
 * top rung of the ladder, and the All Eights badge denominator). Baked so
 * the scramble can avoid displaying a valid word before any dictionary
 * loads. */
export interface CalendarEntry {
  /** Rack signature: sorted letters. */
  rack: string;
  /** Every eight-letter validation-boundary word formable from the rack. */
  eights: string[];
}

export interface Calendar {
  /** The calendar epoch: which date entry 0 falls on. MOVABLE. A future
   * regeneration may re-anchor it freely; it never keys storage. */
  epoch: string;
  /** APPEND-ONLY. Day N is the entry at position N. Never reorder, never
   * remove; new racks go on the end, forever. */
  entries: CalendarEntry[];
}
