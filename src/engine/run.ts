import { allowsPlay } from './rules';
import { removeSig, sigContains, toSignature } from './signature';
import { MIN_WORD_LENGTH, type EndgameRule } from './types';
import { wordScore } from './values';

/** What a run needs to judge plays. A Puzzle satisfies this.
 *
 * TWO DICTIONARIES, TWO JOBS. The boundary ACCEPTS; the common pool DECIDES.
 * They are not interchangeable, and confusing them is the bug that made a
 * played-out run report itself as "Rested early" (GDD, "The solver and the
 * run must play the same game"). */
export interface RunContext {
  /** Rack signature (sorted letters). */
  rack: string;
  /** What you may PLAY: the validation boundary, filtered to the rack.
   * Generous acceptance. An off-pool word still scores and is still a lovely
   * surprise. */
  valid: ReadonlySet<string>;
  /** What keeps you ALIVE: the common pool, filtered to the rack. The ladder
   * dictionary, and the same one par, the gate, and Clean Descent are judged
   * on. The run ends when this is spent, whatever obscurities the boundary
   * still holds. */
  common: ReadonlySet<string>;
  rule: EndgameRule;
}

export interface PlayedWord {
  word: string;
  score: number;
  length: number;
}

/** A letter that left the game, stamped with the play that spent it. The
 * presentation layer renders decay age from playIndex; the engine owns it. */
export interface SpentLetter {
  letter: string;
  playIndex: number;
}

export interface RunState {
  /** Current pool signature. */
  pool: string;
  played: readonly PlayedWord[];
  spent: readonly SpentLetter[];
  score: number;
  /** True when no legal, unplayed, COMMON-POOL word can be formed. Boundary
   * obscurities left on the table do not keep a run alive. */
  ended: boolean;
}

export interface RunResult {
  score: number;
  words: readonly PlayedWord[];
  /** clean-finish means the ladder is genuinely spent and earns the line the
   * whole game is named for; stopped means the player walked away while
   * words remained. Different facts, and the end screen says different
   * things. */
  endReason: 'clean-finish' | 'stopped';
  finalPoolSize: number;
  isCleanDescent: boolean;
}

/** Is the ladder still standing? Judged on the COMMON pool, never the
 * boundary: the run is over when the player's actual vocabulary is spent,
 * not when the last SCOWL-95 obscurity has been mined out of it.
 *
 * It applies the endgame rule and not merely formability, and that matters:
 * under `descent` nothing is legal at a pool of three, so the run must end
 * there even though common three-letter words are formable in the abstract.
 * Asking only "is a common word formable" is correct under `mill` and
 * silently wrong the moment the flag flips. */
function hasLegalPlay(
  ctx: RunContext,
  pool: string,
  played: ReadonlySet<string>,
): boolean {
  for (const w of ctx.common) {
    if (played.has(w)) continue;
    if (!allowsPlay(ctx.rule, pool.length, w.length)) continue;
    if (sigContains(pool, toSignature(w))) return true;
  }
  return false;
}

export function createRun(ctx: RunContext): RunState {
  return {
    pool: ctx.rack,
    played: [],
    spent: [],
    score: 0,
    ended: !hasLegalPlay(ctx, ctx.rack, new Set()),
  };
}

export function isLegalPlay(
  ctx: RunContext,
  state: RunState,
  word: string,
): boolean {
  if (state.ended) return false;
  if (word.length < MIN_WORD_LENGTH) return false;
  if (!ctx.valid.has(word)) return false;
  if (state.played.some((p) => p.word === word)) return false;
  if (!allowsPlay(ctx.rule, state.pool.length, word.length)) return false;
  return sigContains(state.pool, toSignature(word));
}

export function applyPlay(
  ctx: RunContext,
  state: RunState,
  word: string,
): RunState {
  if (!isLegalPlay(ctx, state, word)) {
    throw new Error(`illegal play: ${word}`);
  }
  const playIndex = state.played.length;
  const wordSig = toSignature(word);
  const spentNow = removeSig(state.pool, wordSig);
  const played = [
    ...state.played,
    { word, score: wordScore(word), length: word.length },
  ];
  const playedWords = new Set(played.map((p) => p.word));
  return {
    pool: wordSig,
    played,
    spent: [
      ...state.spent,
      ...[...spentNow].map((letter) => ({ letter, playIndex })),
    ],
    score: state.score + wordScore(word),
    ended: !hasLegalPlay(ctx, wordSig, playedWords),
  };
}

/** Clean Descent: no step dropped more than one letter and the run ends at
 * a pool of exactly three. Holds never break it. */
function isCleanDescent(ctx: RunContext, state: RunState): boolean {
  let poolSize = ctx.rack.length;
  for (const p of state.played) {
    if (p.length < poolSize - 1) return false;
    poolSize = p.length;
  }
  return poolSize === 3;
}

export function finishRun(ctx: RunContext, state: RunState): RunResult {
  return {
    score: state.score,
    words: state.played,
    endReason: state.ended ? 'clean-finish' : 'stopped',
    finalPoolSize: state.pool.length,
    isCleanDescent: isCleanDescent(ctx, state),
  };
}
