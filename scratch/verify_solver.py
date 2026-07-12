#!/usr/bin/env python3
"""Cross-check the collapsed solver against a naive exhaustive search.

Naive state = (pool signature, frozenset of played words still formable
from the pool). No milk-all-holds assumption; holds and drops interleave
freely. Compares par, best clean score, and max run length on a sample.
"""

import itertools
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ladder_analysis import Solver, load_file, scowl_upto, score, NEG, RAW


def formable(word, pool):
    return not (Counter(word) - Counter(pool))


def naive(solver, rack_sig):
    memo = {}

    def sub_words(pool):
        out = []
        seen = set()
        for k in range(3, len(pool) + 1):
            seen.update(itertools.combinations(pool, k))
        for c in seen:
            q = "".join(c)
            out.extend(solver.classes.get(q, ()))
        return out

    def rec(pool, played):
        key = (pool, played)
        if key in memo:
            return memo[key]
        plays = [w for w in sub_words(pool) if w not in played]
        if not plays:
            res = (0, 0 if len(pool) == 3 else NEG, 0)
        else:
            v = l = 0
            c = NEG
            for w in plays:
                q = "".join(sorted(w))
                nplayed = frozenset(
                    p for p in (played | {w}) if formable(p, q))
                qv, qc, ql = rec(q, nplayed)
                s = score(w)
                v = max(v, s + qv)
                l = max(l, 1 + ql)
                if len(w) >= len(pool) - 1 and qc != NEG:
                    c = max(c, s + qc)
            res = (v, c, l)
        memo[key] = res
        return res

    return rec(rack_sig, frozenset())


def main():
    random.seed(42)
    scowl35 = {w for w in scowl_upto(35) if len(w) >= 3}
    sol = Solver(scowl35)
    sources7 = sorted({"".join(sorted(w)) for w in scowl35 if len(w) == 7})
    sample = random.sample(sources7, 40)
    sample += ["adeiprs", "aoprrsw", "adehrst", "acllops"]
    bad = 0
    for sig in sample:
        par, best_clean, maxlen = sol.solve_rack(sig)
        nv, nc, nl = naive(sol, sig)
        nclean = None if nc == NEG else nc
        ok = (par == nv and best_clean == nclean and maxlen == nl)
        if not ok:
            bad += 1
            print(f"MISMATCH {sig}: fast=({par},{best_clean},{maxlen}) "
                  f"naive=({nv},{nclean},{nl})")
    print(f"checked {len(sample)} racks, mismatches: {bad}")


if __name__ == "__main__":
    main()
