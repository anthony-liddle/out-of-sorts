import type { SigIndex } from './dictionary';
import { allowsPlay, isRestrictedSize } from './rules';
import { subSignatures } from './signature';
import { MIN_WORD_LENGTH, type EndgameRule } from './types';
import { wordScore } from './values';

// Exhaustive, exact solver. No heuristics, no sampling.
//
// The reduction that makes it tractable, proven in discovery pass 2 against
// a naive brute force with zero mismatches: a hold never changes the pool
// and always adds positive score, so every optimal path plays all available
// holds before dropping. Search state therefore collapses from
// (pool, played set) to the pool signature alone, with each anagram class's
// summed score banked on arrival. Values are global per dictionary and rule,
// so the memo is shared across racks.
//
// The endgame rules only restrict how many plays are legal at a pool size,
// never which pool is reachable, so the same reduction holds with rule-aware
// banking: a restricted size banks its single best-scoring word instead of
// the class sum.

const NEG = Number.NEGATIVE_INFINITY;

export interface RackSolution {
  /** Max score, common pool only. Never computed against the boundary. */
  par: number;
  /** Max score over Clean Descents, or null when none exists. */
  bestClean: number | null;
  /** Longest possible run in words. */
  maxDepth: number;
}

export interface HoldInventory {
  /** All words spelled with the entire rack, the source word included. */
  fullRackWords: readonly string[];
  /** Hold opportunities by pool size: sum of (class size - 1) over anagram
   * classes of that size holding two or more words. */
  holdsBySize: Readonly<Record<number, number>>;
}

export interface GreedyResult {
  score: number;
  words: number;
  clean: boolean;
}

interface PoolValue {
  score: number;
  clean: number;
  depth: number;
}

export class Solver {
  private readonly index: SigIndex;
  readonly rule: EndgameRule;
  private readonly banked = new Map<
    string,
    { gain: number; count: number; plays: readonly string[] }
  >();
  private readonly memo = new Map<string, PoolValue>();

  constructor(commonIndex: SigIndex, rule: EndgameRule) {
    this.index = commonIndex;
    this.rule = rule;
  }

  /** Rule-aware banking for one anagram class: the class sum where holds
   * are legal, the single best-scoring word where they are not. */
  private bank(sig: string) {
    let entry = this.banked.get(sig);
    if (entry) return entry;
    const words = this.index.get(sig);
    if (!words) throw new Error(`no words at signature ${sig}`);
    if (isRestrictedSize(this.rule, sig.length)) {
      let best = words[0]!;
      for (const w of words) {
        if (
          wordScore(w) > wordScore(best) ||
          (wordScore(w) === wordScore(best) && w > best)
        ) {
          best = w;
        }
      }
      entry = { gain: wordScore(best), count: 1, plays: [best] };
    } else {
      let gain = 0;
      for (const w of words) gain += wordScore(w);
      entry = { gain, count: words.length, plays: words };
    }
    this.banked.set(sig, entry);
    return entry;
  }

  /** Strict sub-signatures of the pool that hold at least one word. */
  private drops(pool: string): string[] {
    const out: string[] = [];
    for (const sig of subSignatures(pool, MIN_WORD_LENGTH)) {
      if (sig.length < pool.length && this.index.has(sig)) out.push(sig);
    }
    return out;
  }

  /** Best future (score, clean score, depth) from a pool AFTER its own
   * class has been banked. clean is NEG when no clean completion exists. */
  private evalPool(pool: string): PoolValue {
    const hit = this.memo.get(pool);
    if (hit) return hit;
    const drops = this.drops(pool);
    let value: PoolValue;
    if (drops.length === 0) {
      value = { score: 0, clean: pool.length === 3 ? 0 : NEG, depth: 0 };
    } else {
      let score = 0;
      let depth = 0;
      let clean = NEG;
      for (const q of drops) {
        const sub = this.evalPool(q);
        const { gain, count } = this.bank(q);
        score = Math.max(score, gain + sub.score);
        depth = Math.max(depth, count + sub.depth);
        if (q.length === pool.length - 1 && sub.clean !== NEG) {
          clean = Math.max(clean, gain + sub.clean);
        }
      }
      value = { score, clean, depth };
    }
    this.memo.set(pool, value);
    return value;
  }

  solveRack(rack: string): RackSolution {
    const base = this.index.has(rack)
      ? this.bank(rack)
      : { gain: 0, count: 0, plays: [] };
    const { score, clean, depth } = this.evalPool(rack);
    return {
      par: base.gain + score,
      bestClean: clean === NEG ? null : base.gain + clean,
      maxDepth: base.count + depth,
    };
  }

  /** Words of one par-achieving path, in play order. Ties between equal
   * drops break toward the lexicographically greatest signature. */
  parPath(rack: string): string[] {
    return this.walk(rack, (q, pool) => {
      void pool;
      return this.bank(q).gain + this.evalPool(q).score;
    });
  }

  /** Words of one best-clean path, or null when no Clean Descent exists. */
  cleanPath(rack: string): string[] | null {
    if (this.solveRack(rack).bestClean === null) return null;
    return this.walk(rack, (q, pool) => {
      if (q.length !== pool.length - 1) return NEG;
      const clean = this.evalPool(q).clean;
      return clean === NEG ? NEG : this.bank(q).gain + clean;
    });
  }

  private walk(
    rack: string,
    value: (drop: string, pool: string) => number,
  ): string[] {
    const words: string[] = [];
    let pool = rack;
    for (;;) {
      if (this.index.has(pool)) words.push(...this.bank(pool).plays);
      let best: string | null = null;
      let bestValue = NEG;
      for (const q of this.drops(pool)) {
        const v = value(q, pool);
        if (v === NEG) continue;
        if (v > bestValue || (v === bestValue && best !== null && q > best)) {
          best = q;
          bestValue = v;
        }
      }
      if (best === null) return words;
      pool = best;
    }
  }

  holdInventory(rack: string): HoldInventory {
    const holdsBySize: Record<number, number> = {};
    for (const sig of subSignatures(rack, MIN_WORD_LENGTH)) {
      const words = this.index.get(sig);
      if (words && words.length >= 2) {
        holdsBySize[sig.length] =
          (holdsBySize[sig.length] ?? 0) + words.length - 1;
      }
    }
    return { fullRackWords: this.index.get(rack) ?? [], holdsBySize };
  }

  /** Greedy-longest baseline: longest word, then highest Scrabble value,
   * then alphabetically first. Rule-aware. Used for verification. */
  greedy(rack: string): GreedyResult {
    const played = new Set<string>();
    let pool = rack;
    let score = 0;
    let clean = true;
    for (;;) {
      let best: string | null = null;
      for (const sig of subSignatures(pool, MIN_WORD_LENGTH)) {
        if (!allowsPlay(this.rule, pool.length, sig.length)) continue;
        for (const w of this.index.get(sig) ?? []) {
          if (played.has(w)) continue;
          if (
            best === null ||
            w.length > best.length ||
            (w.length === best.length && wordScore(w) > wordScore(best)) ||
            (w.length === best.length &&
              wordScore(w) === wordScore(best) &&
              w < best)
          ) {
            best = w;
          }
        }
      }
      if (best === null) break;
      played.add(best);
      score += wordScore(best);
      if (best.length < pool.length - 1) clean = false;
      pool = [...best].sort().join('');
    }
    return {
      score,
      words: played.size,
      clean: clean && pool.length === 3,
    };
  }
}
