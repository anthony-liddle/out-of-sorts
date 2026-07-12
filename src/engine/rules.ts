import { MIN_WORD_LENGTH, type EndgameRule } from './types';

// Pool sizes where at most one play is allowed. The word that lands the pool
// at that size is the one play, so the restriction is exactly: no holds
// there. This is the single predicate the endgame flag hangs on; both play
// legality and the solver route through it. Do not branch on the rule
// anywhere else.
const RESTRICTED: Readonly<Record<EndgameRule, ReadonlySet<number>>> = {
  mill: new Set(),
  'terminal-three': new Set([3]),
  descent: new Set([3, 4]),
};

export function allowsPlay(
  rule: EndgameRule,
  poolSize: number,
  wordLength: number,
): boolean {
  if (wordLength < MIN_WORD_LENGTH || wordLength > poolSize) return false;
  return !(wordLength === poolSize && RESTRICTED[rule].has(poolSize));
}

export function isRestrictedSize(rule: EndgameRule, size: number): boolean {
  return RESTRICTED[rule].has(size);
}
