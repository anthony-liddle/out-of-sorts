// CLI entry for the cross-language verification sweep. Prints the computed
// statistics per endgame rule and any diffs against the Python discovery
// results, and exits nonzero on mismatch.
import { loadDictionaries } from '../src/engine/load-node';
import { runSweepComparison } from './verify-sweep-lib';

const start = performance.now();
const { diffs, computed } = runSweepComparison(loadDictionaries());
const elapsed = ((performance.now() - start) / 1000).toFixed(1);

for (const [rule, m] of Object.entries(computed)) {
  console.log(
    `${rule}: gate ${m.gate_words}/${m.source_words} (${m.gate_words_pct}%), ` +
      `par ${m.par.median}/${m.par.mean}, ` +
      `depth ${m.depth.min}/${m.depth.median}/${m.depth.max}, ` +
      `teeth ${m.teeth_diverge_pct}% gap ${m.teeth_gap_pct_median}%, ` +
      `fullhold ${m.fullrack_hold_pct}%, ` +
      `greedy par ${m.greedy.greedy_par_pct}% clean ${m.greedy.greedy_clean_pct}%`,
  );
}
console.log(`sweep completed in ${elapsed}s`);

if (diffs.length > 0) {
  console.error(`\n${diffs.length} mismatches against the Python reference:`);
  for (const d of diffs) console.error(`  ${d}`);
  process.exit(1);
}
console.log('all statistics match the Python reference exactly');
