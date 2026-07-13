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

/** Scramble the rack. Turn one must not be a freebie: the display is never
 * an arrangement the caller forbids (the source word, and any valid
 * boundary word when the dictionary is available). Takes a predicate
 * rather than the boundary itself so the rack can render before the
 * dictionary index exists. */
export function scrambleRack(
  sourceWord: string,
  seed: number,
  isForbidden: (display: string) => boolean,
): string {
  const rand = mulberry32(seed);
  const letters = [...sourceWord];
  for (let attempt = 0; attempt < 100; attempt++) {
    for (let i = letters.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [letters[i], letters[j]] = [letters[j]!, letters[i]!];
    }
    const display = letters.join('');
    if (display !== sourceWord && !isForbidden(display)) return display;
  }
  return [...sourceWord].reverse().join('');
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
