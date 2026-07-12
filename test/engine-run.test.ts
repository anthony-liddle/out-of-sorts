import { describe, expect, it } from 'vitest';
import { LETTER_VALUES, wordScore } from '../src/engine/values';
import {
  applyPlay,
  createRun,
  finishRun,
  isLegalPlay,
  type RunContext,
  type RunState,
} from '../src/engine/run';

// A small controlled language over the rack AERST:
//   5 letters: tares, tears, stare, rates (holds at the full rack)
//   4 letters: east, eats, seat (sig aest), ears (sig aers)
//   3 letters: ate, eat, tea (sig aet)
const VALID = new Set([
  'tares',
  'tears',
  'stare',
  'rates',
  'east',
  'eats',
  'seat',
  'ears',
  'ate',
  'eat',
  'tea',
]);

function ctx(rule: RunContext['rule']): RunContext {
  return { rack: 'aerst', valid: VALID, rule };
}

function playAll(c: RunContext, words: string[]): RunState {
  let state = createRun(c);
  for (const w of words) state = applyPlay(c, state, w);
  return state;
}

describe('run state', () => {
  it('starts at the rack with nothing played and is not ended', () => {
    const state = createRun(ctx('mill'));
    expect(state.pool).toBe('aerst');
    expect(state.played).toEqual([]);
    expect(state.spent).toEqual([]);
    expect(state.score).toBe(0);
    expect(state.ended).toBe(false);
  });

  it('a play reduces the pool to exactly the played word letters', () => {
    const state = playAll(ctx('mill'), ['tares', 'east']);
    expect(state.pool).toBe('aest');
    expect(state.played.map((p) => p.word)).toEqual(['tares', 'east']);
  });

  it('records spent letters with the play index that spent them', () => {
    const state = playAll(ctx('mill'), ['tares', 'east', 'ate']);
    expect(state.spent).toEqual([
      { letter: 'r', playIndex: 1 },
      { letter: 's', playIndex: 2 },
    ]);
  });

  it('does not mutate the previous state', () => {
    const c = ctx('mill');
    const s0 = createRun(c);
    const s1 = applyPlay(c, s0, 'tares');
    expect(s0.played).toEqual([]);
    expect(s0.pool).toBe('aerst');
    expect(s1.played).toHaveLength(1);
  });

  it('rejects a word already played this run', () => {
    const c = ctx('mill');
    const state = playAll(c, ['tares']);
    expect(isLegalPlay(c, state, 'tares')).toBe(false);
    expect(() => applyPlay(c, state, 'tares')).toThrow();
    expect(isLegalPlay(c, state, 'tears')).toBe(true);
  });

  it('rejects words not formable, not valid, or too short', () => {
    const c = ctx('mill');
    const state = createRun(c);
    expect(isLegalPlay(c, state, 'tarps')).toBe(false);
    expect(isLegalPlay(c, state, 'ras')).toBe(false);
    expect(isLegalPlay(c, state, 'at')).toBe(false);
  });

  it('score agrees between both formulations', () => {
    const c = ctx('mill');
    const state = playAll(c, ['tares', 'tears', 'east', 'ate']);
    const bySum = ['tares', 'tears', 'east', 'ate'].reduce(
      (acc, w) => acc + wordScore(w),
      0,
    );
    expect(state.score).toBe(bySum);
    // Each letter's value times the number of words it survived in. A letter
    // spent at play k survived plays 0..k-1, so it survived k words. A letter
    // still in the final pool survived every play.
    const bySurvival =
      state.spent.reduce(
        (acc, s) => acc + LETTER_VALUES[s.letter]! * s.playIndex,
        0,
      ) +
      [...state.pool].reduce(
        (acc, l) => acc + LETTER_VALUES[l]! * state.played.length,
        0,
      );
    expect(state.score).toBe(bySurvival);
    expect(bySum).toBe(bySurvival);
  });
});

describe('end detection', () => {
  it('ends when and only when no legal unplayed valid word can be formed', () => {
    const c: RunContext = {
      rack: 'aerst',
      valid: new Set(['tares', 'east', 'ate']),
      rule: 'mill',
    };
    let state = createRun(c);
    expect(state.ended).toBe(false);
    state = applyPlay(c, state, 'tares');
    expect(state.ended).toBe(false);
    state = applyPlay(c, state, 'east');
    expect(state.ended).toBe(false);
    state = applyPlay(c, state, 'ate');
    expect(state.ended).toBe(true);
  });

  it('distinguishes a clean finish from the player stopping', () => {
    const c: RunContext = {
      rack: 'aerst',
      valid: new Set(['tares', 'east', 'ate']),
      rule: 'mill',
    };
    const stoppedEarly = finishRun(c, playAll(c, ['tares', 'east']));
    expect(stoppedEarly.endReason).toBe('stopped');
    const dead = finishRun(c, playAll(c, ['tares', 'east', 'ate']));
    expect(dead.endReason).toBe('clean-finish');
  });
});

describe('clean descent detection', () => {
  it('holds do not break it and it must end at a pool of three', () => {
    const c = ctx('mill');
    const clean = finishRun(c, playAll(c, ['tares', 'tears', 'east', 'ate']));
    expect(clean.isCleanDescent).toBe(true);
  });

  it('a two letter drop breaks it', () => {
    const c = ctx('mill');
    const jumped = finishRun(c, playAll(c, ['tares', 'ate']));
    expect(jumped.isCleanDescent).toBe(false);
  });

  it('ending above a pool of three is not a clean descent', () => {
    const c = ctx('mill');
    const high = finishRun(c, playAll(c, ['tares', 'east']));
    expect(high.isCleanDescent).toBe(false);
  });
});

describe('endgame rule flag', () => {
  it('mill allows a second word from the same three letter pool', () => {
    const c = ctx('mill');
    const state = playAll(c, ['tares', 'east', 'ate']);
    expect(isLegalPlay(c, state, 'eat')).toBe(true);
  });

  it('terminal-three ends the run after the first three letter play', () => {
    const c = ctx('terminal-three');
    const state = playAll(c, ['tares', 'east', 'ate']);
    expect(isLegalPlay(c, state, 'eat')).toBe(false);
    expect(state.ended).toBe(true);
  });

  it('descent bans a second four letter word from a four letter pool', () => {
    const c = ctx('descent');
    const state = playAll(c, ['tares', 'east']);
    expect(isLegalPlay(c, state, 'eats')).toBe(false);
    expect(isLegalPlay(c, state, 'ate')).toBe(true);
  });

  it('mill allows the four letter hold that descent bans', () => {
    const c = ctx('mill');
    const state = playAll(c, ['tares', 'east']);
    expect(isLegalPlay(c, state, 'eats')).toBe(true);
  });
});
