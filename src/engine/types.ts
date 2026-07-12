// The endgame rule is a playtest question and must stay a config flag.
// mill: no restriction, holds legal at every pool size. The default.
// terminal-three: one play at a pool of three, then the run ends.
// descent: under five letters every word must be shorter than the last,
// implemented as at most one play each at pool sizes 4 and 3.
export type EndgameRule = 'mill' | 'terminal-three' | 'descent';

export interface EngineConfig {
  rule: EndgameRule;
}

export const DEFAULT_CONFIG: EngineConfig = { rule: 'mill' };

export const MIN_WORD_LENGTH = 3;
