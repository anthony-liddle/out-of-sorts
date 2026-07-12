#!/usr/bin/env python3
"""Verify variant solvers against a naive search, print Q4 paths, and
report absolute grind counts per run."""

import itertools
import random
import sys
from collections import Counter
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ladder_analysis import scowl_upto, score, NEG
from tail_analysis import VSolver, VARIANTS


def naive(sol, rack):
    """No-assumptions search. Variant rules expressed directly:
    words of len >= min_len; a hold (len == pool size) is illegal when the
    pool size is in the restricted set."""
    memo = {}

    def formable(w, pool):
        return not (Counter(w) - Counter(pool))

    def plays_from(pool, played):
        out = []
        seen = set()
        for k in range(sol.min_len, len(pool) + 1):
            seen.update(itertools.combinations(pool, k))
        for c in seen:
            q = "".join(c)
            for w in sol.classes.get(q, ()):  # classes already >= min_len
                if w in played:
                    continue
                if len(w) == len(pool) and len(pool) in sol.single:
                    continue
                out.append(w)
        return out

    def rec(pool, played):
        key = (pool, played)
        if key in memo:
            return memo[key]
        plays = plays_from(pool, played)
        if not plays:
            res = (0, 0 if len(pool) == sol.min_len else NEG, 0)
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

    return rec(rack, frozenset())


def main():
    random.seed(7)
    words50 = scowl_upto(50)
    sols = {v: VSolver(words50, **spec) for v, spec in VARIANTS.items()}
    racks = random.sample(
        sorted({"".join(sorted(w)) for w in scowl_upto(35) if len(w) == 7}),
        15) + ["aoprrsw", "acllops", "fioprst", "eiprsst"]

    bad = 0
    for v, sol in sols.items():
        for sig in racks:
            fast = sol.solve_rack(sig)
            nv, nc, nl = naive(sol, sig)
            naive_res = (nv, None if nc == NEG else nc, nl)
            if fast != naive_res:
                bad += 1
                print(f"MISMATCH {v} {sig}: fast={fast} naive={naive_res}")
    print(f"verified {len(racks)} racks x 4 variants, mismatches: {bad}\n")

    for sig, name in [("aoprrsw", "SPARROW"), ("acllops", "SCALLOP"),
                      ("fioprst", "PROFITS"), ("eiprsst", "PERSIST")]:
        print(f"--- {name} ({sig}) at (35, 50) ---")
        for v, sol in sols.items():
            words = sol.path_words(sig)
            par, clean, _ = sol.solve_rack(sig)
            tag = "clean-par" if clean == par else "teeth"
            seq = " > ".join(f"{w}({score(w)})" for w in words)
            print(f"{v} par {par:3d} ({tag}): {seq}")
        print()

    print("Absolute grind, (7, 35, 50) survivors, par path, per run:")
    src = sorted({"".join(sorted(w))
                  for w in scowl_upto(35) if len(w) == 7})
    surv = [s for s in src if sols["A"].solve_rack(s)[1] is not None]
    for v, sol in sols.items():
        tot = g34 = 0
        for s in surv:
            per = sol.profile(s)
            tot += sum(p[0] for p in per.values())
            g34 += sum(per[r][0] for r in (3, 4) if r in per)
        print(f"{v}: mean plays/run {tot/len(surv):.2f}, "
              f"mean rung-3+4 plays/run {g34/len(surv):.2f}")


if __name__ == "__main__":
    main()
