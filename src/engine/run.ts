import { allowsPlay } from './rules';
import { removeSig, sigContains, toSignature } from './signature';
import { MIN_WORD_LENGTH, type EndgameRule } from './types';
import { wordScore } from './values';

/** What a run needs to judge plays. A Puzzle satisfies this. */
export interface RunContext {
  /** Rack signature (sorted letters). */
  rack: string;
  /** Valid words formable from the rack (validation boundary, filtered). */
  valid: ReadonlySet<string>;
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
  /** True when no legal, unplayed, valid word can be formed. */
  ended: boolean;
}

export interface RunResult {
  score: number;
  words: readonly PlayedWord[];
  /** clean-finish means the pool is genuinely dead; stopped means the
   * player chose to end while plays remained. Different facts, and the end
   * screen shows different things. */
  endReason: 'clean-finish' | 'stopped';
  finalPoolSize: number;
  isCleanDescent: boolean;
}

function hasLegalPlay(
  ctx: RunContext,
  pool: string,
  played: ReadonlySet<string>,
): boolean {
  for (const w of ctx.valid) {
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
