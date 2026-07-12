import { describe, expect, it } from 'vitest';
import { createEngine } from '../src/engine/engine';
import { toSignature } from '../src/engine/signature';
import { wordScore } from '../src/engine/values';
import { applyPlay, createRun } from '../src/engine/run';
import { realDicts } from './helpers/dicts';

describe('puzzle creation', () => {
  const engine = createEngine(realDicts());
  const puzzle = engine.createPuzzle('triangle');

  it('carries the rack signature and the endgame rule', () => {
    expect(puzzle.rack).toBe('aegilnrt');
    expect(puzzle.rule).toBe('mill');
    expect(puzzle.sourceWord).toBe('triangle');
  });

  it('scrambles the display: never the source word, never a valid word', () => {
    expect(puzzle.display).toHaveLength(8);
    expect(toSignature(puzzle.display)).toBe('aegilnrt');
    expect(puzzle.display).not.toBe('triangle');
    expect(realDicts().boundary.has(puzzle.display)).toBe(false);
  });

  it('scrambling is deterministic for a given seed', () => {
    const a = engine.createPuzzle('triangle', 7);
    const b = engine.createPuzzle('triangle', 7);
    const c = engine.createPuzzle('triangle', 8);
    expect(a.display).toBe(b.display);
    expect(a.display).not.toBe(c.display);
  });

  it('filters the boundary and common pool down to the rack', () => {
    expect(puzzle.valid.has('triangle')).toBe(true);
    expect(puzzle.valid.has('alerting')).toBe(true);
    expect(puzzle.valid.has('rat')).toBe(true);
    expect(puzzle.valid.has('sparrow')).toBe(false);
    expect(puzzle.common.has('triangle')).toBe(true);
    for (const w of puzzle.common) expect(puzzle.valid.has(w)).toBe(true);
  });

  it('embeds the solve: par, best clean, depth, paths, holds', () => {
    expect(puzzle.holds.fullRackWords).toEqual([
      'alerting',
      'altering',
      'integral',
      'relating',
      'triangle',
    ]);
    expect(puzzle.par).toBeGreaterThan(0);
    expect(puzzle.bestClean).not.toBeNull();
    expect(puzzle.parPath.reduce((acc, w) => acc + wordScore(w), 0)).toBe(
      puzzle.par,
    );
    expect(puzzle.cleanPath!.reduce((acc, w) => acc + wordScore(w), 0)).toBe(
      puzzle.bestClean,
    );
    expect(puzzle.parPath.length).toBeLessThanOrEqual(puzzle.maxDepth);
  });

  it('a puzzle drives a run end to end', () => {
    let state = createRun(puzzle);
    state = applyPlay(puzzle, state, 'triangle');
    state = applyPlay(puzzle, state, 'relating');
    expect(state.pool).toBe('aegilnrt');
    expect(state.score).toBeGreaterThan(0);
  });
});

describe('performance budget', () => {
  it('creates a puzzle, full solve included, far inside 150ms', () => {
    const engine = createEngine(realDicts());
    engine.createPuzzle('operands');
    const t = performance.now();
    engine.createPuzzle('tapestry');
    // 150ms is the mid-range phone budget; desktop must be well under it.
    expect(performance.now() - t).toBeLessThan(150);
  });
});

describe('the gate', () => {
  const engine = createEngine(realDicts());

  it('admits a source word whose rack has a clean descent', () => {
    expect(engine.isEligible('triangle')).toBe(true);
  });

  it('is not configurable and is invariant across endgame rules', () => {
    const sample = ['despairs', 'reprisal', 'sharpest', 'triangle', 'operands'];
    const byRule = (['mill', 'terminal-three', 'descent'] as const).map(
      (rule) =>
        sample.map((w) => createEngine(realDicts(), { rule }).isEligible(w)),
    );
    expect(byRule[1]).toEqual(byRule[0]);
    expect(byRule[2]).toEqual(byRule[0]);
  });
});
