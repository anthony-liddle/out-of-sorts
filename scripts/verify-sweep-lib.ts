// Cross-language verification sweep. Runs the full 8-letter population
// (source SCOWL 35, common SCOWL 50) through the TypeScript solver under all
// three endgame rules and diffs every statistic against the Python discovery
// results committed in scratch/. Any mismatch is a bug, not a rounding
// difference: report the diff, never adjust the expectation.
//
// Statistic definitions replicate the Python scripts exactly: median is the
// mean of the two middle values on even counts, p25 and p75 are the sorted
// values at floor(n/4) and floor(3n/4), percentages round to one decimal and
// means to two.
import { readFileSync } from 'node:fs';
import type { Dictionaries } from '../src/engine/dictionary';
import { toSignature } from '../src/engine/signature';
import { Solver } from '../src/engine/solver';
import type { EndgameRule } from '../src/engine/types';

const RULE_TO_PYTHON: Record<EndgameRule, string> = {
  mill: 'A',
  'terminal-three': 'B',
  descent: 'D',
};

function round(x: number, digits: number): number {
  return Number(x.toFixed(digits));
}

function median(sorted: readonly number[]): number {
  const n = sorted.length;
  const mid = Math.floor(n / 2);
  return n % 2 === 1 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
}

function dist(values: readonly number[]) {
  const xs = [...values].sort((a, b) => a - b);
  const mean = xs.reduce((a, b) => a + b, 0) / xs.length;
  return {
    min: xs[0]!,
    p25: xs[Math.floor(xs.length / 4)]!,
    median: median(xs),
    p75: xs[Math.floor((3 * xs.length) / 4)]!,
    max: xs[xs.length - 1]!,
    mean: round(mean, 2),
  };
}

export interface RuleMetrics {
  source_words: number;
  gate_words: number;
  gate_words_pct: number;
  gate_racks: number;
  par: { median: number; mean: number };
  depth: ReturnType<typeof dist>;
  teeth_diverge_pct: number;
  teeth_gap_pct_median: number;
  fullrack_hold_pct: number;
  greedy: {
    greedy_par_pct: number;
    greedy_clean_pct: number;
    score_pct_median: number;
    score_pct_p25: number;
    n: number;
  };
}

export function runSweep(
  dicts: Dictionaries,
): Record<EndgameRule, RuleMetrics> {
  const racks = new Map<string, number>();
  for (const word of dicts.source) {
    const sig = toSignature(word);
    racks.set(sig, (racks.get(sig) ?? 0) + 1);
  }

  const out = {} as Record<EndgameRule, RuleMetrics>;
  for (const rule of ['mill', 'terminal-three', 'descent'] as const) {
    const solver = new Solver(dicts.commonIndex, rule);
    const survivors: {
      sig: string;
      par: number;
      bestClean: number;
      maxDepth: number;
    }[] = [];
    let gateWords = 0;
    for (const [sig, wordCount] of racks) {
      const s = solver.solveRack(sig);
      if (s.bestClean === null) continue;
      survivors.push({
        sig,
        par: s.par,
        bestClean: s.bestClean,
        maxDepth: s.maxDepth,
      });
      gateWords += wordCount;
    }

    const n = survivors.length;
    const pars = dist(survivors.map((s) => s.par));
    const diverging = survivors.filter((s) => s.par !== s.bestClean);
    const gapsPct = diverging
      .map((s) => (100 * (s.par - s.bestClean)) / s.par)
      .sort((a, b) => a - b);
    const fullHolds = survivors.filter(
      (s) => (dicts.commonIndex.get(s.sig)?.length ?? 0) >= 2,
    ).length;

    let greedyPar = 0;
    let greedyClean = 0;
    const scorePct: number[] = [];
    for (const s of survivors) {
      const g = solver.greedy(s.sig);
      if (g.score === s.par) greedyPar++;
      if (g.clean) greedyClean++;
      scorePct.push((100 * g.score) / s.par);
    }
    scorePct.sort((a, b) => a - b);

    const sourceWordCount = [...racks.values()].reduce((a, b) => a + b, 0);
    out[rule] = {
      source_words: sourceWordCount,
      gate_words: gateWords,
      gate_words_pct: round((100 * gateWords) / sourceWordCount, 1),
      gate_racks: n,
      par: {
        median: median(survivors.map((s) => s.par).sort((a, b) => a - b)),
        mean: pars.mean,
      },
      depth: dist(survivors.map((s) => s.maxDepth)),
      teeth_diverge_pct: round((100 * diverging.length) / n, 1),
      teeth_gap_pct_median: round(median(gapsPct), 1),
      fullrack_hold_pct: round((100 * fullHolds) / n, 1),
      greedy: {
        greedy_par_pct: round((100 * greedyPar) / n, 1),
        greedy_clean_pct: round((100 * greedyClean) / n, 1),
        score_pct_median: round(median(scorePct), 1),
        score_pct_p25: round(scorePct[Math.floor(scorePct.length / 4)]!, 1),
        n,
      },
    };
  }
  return out;
}

export interface SweepComparison {
  diffs: string[];
  computed: Record<EndgameRule, RuleMetrics>;
}

export function runSweepComparison(dicts: Dictionaries): SweepComparison {
  const tail = JSON.parse(readFileSync('scratch/results_tail.json', 'utf8'));
  const greedy = JSON.parse(
    readFileSync('scratch/results_greedy_d.json', 'utf8'),
  );
  const computed = runSweep(dicts);
  const diffs: string[] = [];

  const check = (label: string, expected: unknown, actual: unknown) => {
    if (expected !== actual) {
      diffs.push(`${label}: python ${expected}, typescript ${actual}`);
    }
  };

  for (const rule of ['mill', 'terminal-three', 'descent'] as const) {
    const py = tail[`8L src35 common50 ${RULE_TO_PYTHON[rule]}`];
    const ts = computed[rule];
    check(`${rule} source_words`, py.source_words, ts.source_words);
    check(`${rule} gate_words`, py.gate_words, ts.gate_words);
    check(`${rule} gate_words_pct`, py.gate_words_pct, ts.gate_words_pct);
    check(`${rule} gate_racks`, py.gate_racks, ts.gate_racks);
    check(`${rule} par median`, py.par.median, ts.par.median);
    check(`${rule} par mean`, py.par.mean, ts.par.mean);
    for (const k of ['min', 'p25', 'median', 'p75', 'max', 'mean'] as const) {
      check(`${rule} depth ${k}`, py.depth[k], ts.depth[k]);
    }
    check(`${rule} teeth pct`, py.teeth_diverge_pct, ts.teeth_diverge_pct);
    check(
      `${rule} teeth gap median pct`,
      py.teeth_gap_pct_median,
      ts.teeth_gap_pct_median,
    );
    check(
      `${rule} fullrack hold pct`,
      py.fullrack_hold_pct,
      ts.fullrack_hold_pct,
    );
  }

  // Greedy references exist for mill (A) and descent (D) from pass 3.
  for (const [rule, key] of [
    ['mill', 'q1 8L A'],
    ['descent', 'q1 8L D'],
  ] as const) {
    const py = greedy[key];
    const ts = computed[rule].greedy;
    check(`${rule} greedy par pct`, py.greedy_par_pct, ts.greedy_par_pct);
    check(`${rule} greedy clean pct`, py.greedy_clean_pct, ts.greedy_clean_pct);
    check(
      `${rule} greedy score pct median`,
      py.score_pct_median,
      ts.score_pct_median,
    );
    check(`${rule} greedy score pct p25`, py.score_pct_p25, ts.score_pct_p25);
    check(`${rule} greedy n`, py.n, ts.n);
  }

  return { diffs, computed };
}
