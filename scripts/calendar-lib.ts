// Calendar generation library. Pure pieces, unit-tested; the CLI in
// generate-calendar.ts wires them to the real data. Generation is a
// deliberate manual action, never part of a normal build.
//
// THE INVARIANT THAT OUTRANKS EVERYTHING: the committed calendar is
// APPEND-ONLY. Nothing in this module sorts, filters, or dedupes an
// existing committed calendar. It exists to produce the initial artifact
// and, later, to append new entries to the end.
import { toSignature } from '../src/engine/signature';
import { seededShuffle } from '../src/engine/prng';
import type { CalendarEntry } from '../src/calendar/types';

/** Seeds to racks: signatures, deduplicated. Anagram seeds are one rack.
 * Sorted so the pre-shuffle input order is deterministic. */
export function collapseToRacks(seeds: Iterable<string>): string[] {
  return [...new Set([...seeds].map(toSignature))].sort();
}

/** Remove racks matching any excluded word's signature. */
export function excludeSignatures(
  racks: readonly string[],
  excludedWords: readonly string[],
): string[] {
  const sigs = new Set(excludedWords.map(toSignature));
  return racks.filter((r) => !sigs.has(r));
}

/** Denylist rule: a rack whose only eight-letter words are all denied is
 * dropped; a rack with other eights survives and the denied words are
 * simply stripped from its list (they are invalid everywhere via the
 * boundary denylist). */
export function applyDenylist(
  racks: readonly string[],
  eightsByRack: ReadonlyMap<string, readonly string[]>,
  deny: ReadonlySet<string>,
): {
  racks: string[];
  denied: string[];
  eightsFor: (rack: string) => string[];
} {
  const surviving: string[] = [];
  const denied: string[] = [];
  const kept = new Map<string, string[]>();
  for (const rack of racks) {
    const eights = (eightsByRack.get(rack) ?? []).filter((w) => !deny.has(w));
    if (eights.length === 0) {
      denied.push(rack);
    } else {
      surviving.push(rack);
      kept.set(rack, eights);
    }
  }
  return {
    racks: surviving,
    denied,
    eightsFor: (rack) => kept.get(rack) ?? [],
  };
}

/** Proportional merge of two lists, preserving each list's internal order.
 * Longest same-source run is bounded by the size ratio, which is what
 * keeps S racks and non-S racks interleaved instead of clustered. */
export function interleave<T>(a: readonly T[], b: readonly T[]): T[] {
  const out: T[] = [];
  let ia = 0;
  let ib = 0;
  while (ia < a.length || ib < b.length) {
    if (ib >= b.length || (ia < a.length && ia * b.length <= ib * a.length)) {
      out.push(a[ia++]!);
    } else {
      out.push(b[ib++]!);
    }
  }
  return out;
}

/** Deterministic calendar order. S is a pacing lever, not a difficulty
 * lever (discovery pass 4): S racks run four words longer at the median,
 * so interleave the partitions rather than serving a week of twenty-minute
 * racks. Multi-eight racks are spread within each partition first, so they
 * stay spread after the merge. */
export function orderEntries(
  entries: readonly CalendarEntry[],
  seed: number,
  isMulti: (e: CalendarEntry) => boolean = (e) => e.eights.length >= 2,
): CalendarEntry[] {
  const partition = (pred: (e: CalendarEntry) => boolean) => {
    const inSet = entries.filter(pred);
    const single = seededShuffle(
      inSet.filter((e) => !isMulti(e)),
      seed,
    );
    const multi = seededShuffle(inSet.filter(isMulti), seed ^ 0x5f3759df);
    return interleave(single, multi);
  };
  const withS = partition((e) => e.rack.includes('s'));
  const withoutS = partition((e) => !e.rack.includes('s'));
  return interleave(withS, withoutS);
}

/** Longest run statistics for a predicate over an ordered list. */
export function runStats<T>(
  items: readonly T[],
  pred: (item: T) => boolean,
): { longestTrue: number; longestFalse: number } {
  let longestTrue = 0;
  let longestFalse = 0;
  let run = 0;
  let last: boolean | null = null;
  for (const item of items) {
    const v = pred(item);
    run = v === last ? run + 1 : 1;
    last = v;
    if (v) longestTrue = Math.max(longestTrue, run);
    else longestFalse = Math.max(longestFalse, run);
  }
  return { longestTrue, longestFalse };
}
