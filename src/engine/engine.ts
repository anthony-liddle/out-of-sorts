import type { Dictionaries } from './dictionary';
import { hashString, mulberry32 } from './prng';
import { subSignatures, toSignature } from './signature';
import { Solver, type HoldInventory } from './solver';
import {
  DEFAULT_CONFIG,
  MIN_WORD_LENGTH,
  type EndgameRule,
  type EngineConfig,
} from './types';
import type { RunContext } from './run';

export interface Puzzle extends RunContext {
  sourceWord: string;
  /** Rack signature: the source word letters, sorted. */
  rack: string;
  /** Scrambled display order. Never the source word, never a valid word. */
  display: string;
  rule: EndgameRule;
  /** Valid words formable from the rack. Generous acceptance during play. */
  valid: ReadonlySet<string>;
  /** Common pool words formable from the rack. The par dictionary. */
  common: ReadonlySet<string>;
  /** Par: max score using common pool words only. Never the boundary. */
  par: number;
  bestClean: number | null;
  maxDepth: number;
  parPath: readonly string[];
  cleanPath: readonly string[] | null;
  holds: HoldInventory;
}

export interface Engine {
  readonly rule: EndgameRule;
  createPuzzle(sourceWord: string, seed?: number): Puzzle;
  /** The gate: a source word may headline only if a Clean Descent exists
   * for its rack using common pool words only. Every daily is perfectible.
   * Not configurable, and invariant across endgame rules. */
  isEligible(sourceWord: string): boolean;
}

/** Arrange letters for display. THE POOL DISPLAY MUST NEVER SPELL A VALID
 * WORD, AT ANY SIZE: at eight it hands over an opener, below eight it hands
 * over a hold on the rungs where holds are densest. Takes a forbidden
 * predicate rather than the boundary itself so the opening rack can render
 * before the dictionary index exists (the calendar bakes that list).
 *
 * Random attempts first; if the pool is so word-dense that they all miss,
 * a systematic walk of every permutation guarantees termination and finds
 * an allowed arrangement whenever one exists. If literally every
 * arrangement is forbidden, the sorted signature is returned rather than
 * looping: that case does not occur in real dictionaries. */
export function scrambleRack(
  sourceWord: string,
  seed: number,
  isForbidden: (display: string) => boolean,
): string {
  const allowed = (d: string) => d !== sourceWord && !isForbidden(d);
  const rand = mulberry32(seed);
  const letters = [...sourceWord];
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [letters[i], letters[j]] = [letters[j]!, letters[i]!];
    }
    const display = letters.join('');
    if (allowed(display)) return display;
  }
  for (const candidate of permutations([...sourceWord].sort())) {
    if (allowed(candidate)) return candidate;
  }
  return [...sourceWord].sort().join('');
}

/** Every distinct permutation, lazily. Worst case 8! = 40320, and the
 * systematic fallback only runs when 100 random draws all hit words. */
function* permutations(letters: readonly string[]): Generator<string> {
  if (letters.length <= 1) {
    yield letters.join('');
    return;
  }
  const seen = new Set<string>();
  for (let i = 0; i < letters.length; i++) {
    const head = letters[i]!;
    if (seen.has(head)) continue;
    seen.add(head);
    const rest = [...letters.slice(0, i), ...letters.slice(i + 1)];
    for (const tail of permutations(rest)) yield head + tail;
  }
}

/** Every word in the index formable from the rack, via its sub-multisets.
 * 219 signature lookups instead of a scan over 430,172 words. */
function formable(
  rack: string,
  index: ReadonlyMap<string, readonly string[]>,
): Set<string> {
  const out = new Set<string>();
  for (const sig of subSignatures(rack, MIN_WORD_LENGTH)) {
    const words = index.get(sig);
    if (words) for (const w of words) out.add(w);
  }
  return out;
}

export function createEngine(
  dicts: Dictionaries,
  config: EngineConfig = DEFAULT_CONFIG,
): Engine {
  const solver = new Solver(dicts.commonIndex, config.rule);
  return {
    rule: config.rule,
    createPuzzle(sourceWord: string, seed?: number): Puzzle {
      const rack = toSignature(sourceWord);
      const solution = solver.solveRack(rack);
      return {
        sourceWord,
        rack,
        display: scrambleRack(sourceWord, seed ?? hashString(sourceWord), (d) =>
          dicts.boundary.has(d),
        ),
        rule: config.rule,
        valid: formable(rack, dicts.boundaryIndex),
        common: formable(rack, dicts.commonIndex),
        par: solution.par,
        bestClean: solution.bestClean,
        maxDepth: solution.maxDepth,
        parPath: solver.parPath(rack),
        cleanPath: solver.cleanPath(rack),
        holds: solver.holdInventory(rack),
      };
    },
    isEligible(sourceWord: string): boolean {
      // Gate invariance across rules is a solver theorem (banning holds
      // cannot change whether a clean drop chain exists) and is pinned by
      // tests, so the engine's own solver is safe to use here.
      return solver.solveRack(toSignature(sourceWord)).bestClean !== null;
    },
  };
}
