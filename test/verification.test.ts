import { describe, expect, it } from 'vitest';
import { runSweepComparison } from '../scripts/verify-sweep-lib';
import { realDicts } from './helpers/dicts';

// The acceptance test. The Python discovery scripts solved this entire
// problem space exhaustively and were cross-checked against a naive brute
// force with zero mismatches. The TypeScript engine must reproduce their
// numbers exactly, for all three endgame rules, over the full population.
// Any mismatch is a bug, not a rounding difference.
describe('cross-language verification sweep', () => {
  it('reproduces every Python number at 8 letters, source 35, common 50', () => {
    const { diffs } = runSweepComparison(realDicts());
    expect(diffs).toEqual([]);
  });
});
