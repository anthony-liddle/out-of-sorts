import { describe, expect, it } from 'vitest';
import { buildDictionaries } from '../src/engine/dictionary';
import { Solver } from '../src/engine/solver';
import { realDicts } from './helpers/dicts';

// Hand-checkable synthetic dictionary over the rack AERST:
//   aerst: tares tears stare rates (score 5 each)
//   aest:  east eats seat (4 each), aers: ears (4)
//   aet:   ate eat tea (3 each)
const SYNTH = buildDictionaries({
  enable: [
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
  ],
  scowl95Extra: [],
  allow: [],
  deny: [],
  common: [
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
  ],
  source: [],
});

describe('solver on a hand-checkable dictionary', () => {
  it('computes par, best clean, and depth under mill', () => {
    const solver = new Solver(SYNTH.commonIndex, 'mill');
    const { par, bestClean, maxDepth } = solver.solveRack('aerst');
    // All four full-rack holds (20), the aest class (12), the aet class (9).
    expect(par).toBe(41);
    expect(bestClean).toBe(41);
    expect(maxDepth).toBe(10);
  });

  it('banks a single best word at restricted sizes under descent', () => {
    const solver = new Solver(SYNTH.commonIndex, 'descent');
    const { par, bestClean, maxDepth } = solver.solveRack('aerst');
    expect(par).toBe(27);
    expect(bestClean).toBe(27);
    expect(maxDepth).toBe(6);
  });

  it('banks a single word at three under terminal-three', () => {
    const solver = new Solver(SYNTH.commonIndex, 'terminal-three');
    expect(solver.solveRack('aerst').par).toBe(35);
  });

  it('reconstructs a par path whose scores sum to par', () => {
    const solver = new Solver(SYNTH.commonIndex, 'mill');
    const path = solver.parPath('aerst');
    expect(path.slice(0, 4).sort()).toEqual([
      'rates',
      'stare',
      'tares',
      'tears',
    ]);
    expect(path).toHaveLength(10);
  });

  it('returns null best clean when no clean descent exists', () => {
    const noThrees = buildDictionaries({
      enable: [],
      scowl95Extra: [],
      allow: [],
      deny: [],
      common: ['tares', 'east'],
      source: [],
    });
    const solver = new Solver(noThrees.commonIndex, 'mill');
    expect(solver.solveRack('aerst').bestClean).toBeNull();
    expect(solver.solveRack('aerst').par).toBe(9);
  });

  it('greedy plays longest, then highest value, then alphabetical', () => {
    const solver = new Solver(SYNTH.commonIndex, 'mill');
    const g = solver.greedy('aerst');
    // Greedy milks the full rack (20) then picks EARS (alphabetically first
    // four) and strands itself: aers has no three letter words here.
    expect(g.score).toBe(24);
    expect(g.words).toBe(5);
    expect(g.clean).toBe(false);
  });

  it('reports the hold inventory with full-rack holds called out', () => {
    const solver = new Solver(SYNTH.commonIndex, 'mill');
    const holds = solver.holdInventory('aerst');
    expect(holds.fullRackWords).toEqual(['rates', 'stare', 'tares', 'tears']);
    expect(holds.holdsBySize).toEqual({ 5: 3, 4: 2, 3: 2 });
  });
});

describe('solver against discovery-pinned racks (source 35, common 50)', () => {
  const dicts = realDicts();

  it('finds the pinned full-rack hold classes', () => {
    const solver = new Solver(dicts.commonIndex, 'mill');
    expect(solver.holdInventory('aeginrst').fullRackWords).toEqual([
      'angriest',
      'gantries',
      'ingrates',
      'rangiest',
      'tasering',
    ]);
    expect(solver.holdInventory('aeinrrst').fullRackWords).toEqual([
      'restrain',
      'retrains',
      'strainer',
      'terrains',
      'trainers',
    ]);
    expect(solver.holdInventory('aegilnrt').fullRackWords).toEqual([
      'alerting',
      'altering',
      'integral',
      'relating',
      'triangle',
    ]);
  });

  it.each([
    // Pass 2 report, question 4: par paths at (35, 50), 7 letters.
    ['aoprrsw', { mill: 79, 'terminal-three': 67, descent: 49 }],
    ['acllops', { mill: 76, 'terminal-three': 61, descent: 53 }],
    ['fioprst', { mill: 92, 'terminal-three': 82, descent: 52 }],
    ['eiprsst', { mill: 120, 'terminal-three': 115, descent: 109 }],
  ] as const)('reproduces pinned par values for %s', (rack, expected) => {
    for (const [rule, par] of Object.entries(expected)) {
      const solver = new Solver(
        dicts.commonIndex,
        rule as 'mill' | 'terminal-three' | 'descent',
      );
      expect(solver.solveRack(rack).par).toBe(par);
    }
  });

  it('reproduces the worst descent mill rack from pass 3', () => {
    const solver = new Solver(dicts.commonIndex, 'descent');
    expect(solver.solveRack('adeiprs').par).toBe(154);
  });

  it('clean descent existence is invariant across endgame rules', () => {
    const racks = [
      'aoprrsw',
      'acllops',
      'fioprst',
      'eiprsst',
      'aeginrst',
      'adeiprss',
      'aehprsst',
    ];
    const solvers = (['mill', 'terminal-three', 'descent'] as const).map(
      (rule) => new Solver(dicts.commonIndex, rule),
    );
    for (const rack of racks) {
      const gates = solvers.map((s) => s.solveRack(rack).bestClean !== null);
      expect(new Set(gates).size).toBe(1);
    }
  });
});
