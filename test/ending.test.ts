// The run ends on the COMMON pool, not the boundary. GDD v0.6, "The End
// Condition Is Common-Pool": the solver and the run must play the same game.
// Par, the gate, and Clean Descent are all judged on the common pool; the
// end condition used to be judged on the validation boundary, so a real
// player exhausted every word they knew, hit Stop, and was told "Rested
// early." The payoff line the game is named for was being withheld from
// exactly the people who earned it.
//
// Two dictionaries, two jobs, and the tests hold the line between them:
// the boundary ACCEPTS (isLegalPlay), the common pool DECIDES (ended).
import { describe, expect, it } from 'vitest';
import { createEngine, type Puzzle } from '../src/engine/engine';
import { allowsPlay } from '../src/engine/rules';
import {
  applyPlay,
  createRun,
  finishRun,
  isLegalPlay,
  type RunContext,
  type RunState,
} from '../src/engine/run';
import { MIN_WORD_LENGTH, type EndgameRule } from '../src/engine/types';
import { readFileSync } from 'node:fs';
import { realDicts } from './helpers/dicts';
import type { Calendar } from '../src/calendar/types';

const RULES: readonly EndgameRule[] = ['mill', 'terminal-three', 'descent'];
const RACK_SIZE = 8;

/** Every legal play from the current pool, judged on a given dictionary. */
function legalFrom(
  ctx: RunContext,
  state: RunState,
  words: Iterable<string>,
): string[] {
  return [...words].filter((w) => isLegalPlay(ctx, state, w));
}

/** A player who only knows common words, playing until the ladder is spent.
 * Deterministic: always the first legal common word, in set order. */
function playOutCommon(puzzle: Puzzle): RunState {
  let run = createRun(puzzle);
  for (;;) {
    const next = legalFrom(puzzle, run, puzzle.common)[0];
    if (!next) return run;
    run = applyPlay(puzzle, run, next);
  }
}

describe('the monotonic legality lemma', () => {
  // The closure proof (a boundary word can never open a door a common word
  // could not) rests on: words formable from W are formable from P, because
  // W's letters are a sub-multiset of P's. That is enough under mill, where
  // legality IS formability. It is NOT enough under terminal-three or
  // descent, where legality depends on POOL SIZE, so a word could in
  // principle be illegal at P and legal at the smaller W, and the proof
  // collapses. This is the missing step, and it is exhaustive rather than
  // sampled: shrinking the pool can only ever remove legal plays.
  it('a play legal at a smaller pool was legal at the larger one, under every rule', () => {
    for (const rule of RULES) {
      for (let big = MIN_WORD_LENGTH; big <= RACK_SIZE; big++) {
        for (let small = MIN_WORD_LENGTH; small <= big; small++) {
          for (let len = 1; len <= RACK_SIZE + 1; len++) {
            if (!allowsPlay(rule, small, len)) continue;
            expect(
              allowsPlay(rule, big, len),
              `${rule}: length ${len} is legal at pool ${small} but not at pool ${big}`,
            ).toBe(true);
          }
        }
      }
    }
  });
});

describe('end detection reads the common pool, and applies the rule', () => {
  // A controlled language over AERST. 'tsar' and 'tae' are boundary-only:
  // playable for score, but they are not the ladder and they do not decide
  // when the run is over.
  const COMMON = new Set(['tares', 'east', 'ate', 'eat']);
  const ctx = (rule: EndgameRule): RunContext => ({
    rack: 'aerst',
    valid: new Set([...COMMON, 'tsar', 'tae']),
    common: COMMON,
    rule,
  });

  it('ends when the common pool is spent, though boundary words remain', () => {
    const c = ctx('mill');
    let state = createRun(c);
    state = applyPlay(c, state, 'tares');
    state = applyPlay(c, state, 'east');
    state = applyPlay(c, state, 'ate');
    state = applyPlay(c, state, 'eat');
    // 'tae' is still formable, still valid, still unplayed. It is not a
    // reason to keep the player sitting there.
    expect(c.valid.has('tae')).toBe(true);
    expect(state.ended).toBe(true);
    expect(finishRun(c, state).endReason).toBe('clean-finish');
  });

  it('the boundary still accepts: an off-pool word is playable and scores', () => {
    const c = ctx('mill');
    const state = createRun(c);
    expect(isLegalPlay(c, state, 'tsar')).toBe(true);
    const after = applyPlay(c, state, 'tsar');
    expect(after.score).toBeGreaterThan(0);
    expect(after.played.map((p) => p.word)).toEqual(['tsar']);
  });

  it('a boundary word can end your run, and that is a choice, not a bug', () => {
    // The failure mode this change creates, pinned deliberately. The closure
    // proof runs one direction only: a dead pool stays dead. It says nothing
    // about a LIVE pool being spent into a dead one. Here the player is clean
    // at a pool of five, plays an obscure four letter word, lands on a pool
    // with no common words, and the run ends at four with Clean Descent gone.
    // The thesis of the game is which letter you are willing to lose, and
    // spending into a dead end is a loss the player chose.
    //
    // Measured against the real dictionary, this never bites a clean player:
    // 0 of 7,564 boundary plays that would keep a clean player clean strand
    // the pool. The engine permits it anyway, so it is written down.
    const c = ctx('mill');
    let state = createRun(c);
    expect(isLegalPlay(c, state, 'tsar')).toBe(true);
    state = applyPlay(c, state, 'tsar');
    expect(state.pool).toBe('arst');
    expect(state.ended).toBe(true);
    const result = finishRun(c, state);
    expect(result.endReason).toBe('clean-finish');
    expect(result.finalPoolSize).toBe(4);
    expect(result.isCleanDescent).toBe(false);
  });

  it('applies the endgame rule, not merely formability', () => {
    // At a pool of three with a common three letter word formable:
    // mill says play it, descent says the run is over. If end detection only
    // asked "is any common word formable" this passes under mill and is
    // silently wrong the moment the flag flips.
    const words = ['tares', 'east', 'ate'];
    for (const rule of RULES) {
      const c = ctx(rule);
      let state = createRun(c);
      for (const w of words) state = applyPlay(c, state, w);
      expect(state.pool).toBe('aet');
      expect(isLegalPlay(c, state, 'eat')).toBe(rule === 'mill');
      expect(state.ended, `${rule}: a pool of three with EAT formable`).toBe(
        rule !== 'mill',
      );
    }
  });

  it('a rack whose common pool is empty is over before it starts', () => {
    const c: RunContext = {
      rack: 'aerst',
      valid: new Set(['tares']),
      common: new Set(),
      rule: 'mill',
    };
    expect(createRun(c).ended).toBe(true);
  });
});

describe('the closure invariant, against the real dictionary', () => {
  const engine = createEngine(realDicts());
  const calendar: Calendar = JSON.parse(
    readFileSync('public/data/calendar.json', 'utf8'),
  );
  const racks = calendar.entries.slice(0, 40).map((e) => e.rack);

  it('a boundary word can never reopen a door a common word could not', () => {
    for (const rack of racks) {
      const puzzle = engine.createPuzzle(rack);
      const dead = playOutCommon(puzzle);
      expect(dead.ended).toBe(true);
      // Every boundary word still legal here: playing it must leave the
      // common pool just as dead. This is the proof, exercised.
      for (const word of legalFrom(puzzle, dead, puzzle.valid)) {
        const after = applyPlay(puzzle, dead, word);
        expect(
          legalFrom(puzzle, after, puzzle.common),
          `${rack}: ${word} reopened the ladder`,
        ).toEqual([]);
        expect(after.ended).toBe(true);
      }
    }
  });

  it('every played-out run reaches the line the game is named for', () => {
    // Against the committed calendar, not a synthetic fixture. A player who
    // knows only common words must always arrive at "Out of sorts.", never
    // at "Rested early."
    for (const rack of racks) {
      const puzzle = engine.createPuzzle(rack);
      const result = finishRun(puzzle, playOutCommon(puzzle));
      expect(result.endReason, rack).toBe('clean-finish');
    }
  });
});
