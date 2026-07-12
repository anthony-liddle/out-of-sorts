#!/usr/bin/env python3
"""Reconstruct par path vs best clean path for named racks (band 35)."""

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ladder_analysis import Solver, scowl_upto, score, NEG


def path(sol, rack, clean):
    pool = rack
    out = []
    total = 0
    while True:
        for w in sol.classes.get(pool, ()):
            out.append(w)
            total += score(w)
        best_q, best_val = None, NEG
        n = len(pool)
        for q in sol.playable_subsigs(pool, strict=True):
            if clean and len(q) != n - 1:
                continue
            qv, qc, _ = sol.eval_pool(q)
            tail = qc if clean else qv
            if tail == NEG:
                continue
            val = sol.classsum[q] + tail
            if val > best_val:
                best_q, best_val = q, val
        if best_q is None:
            break
        pool = best_q
    return out, total


def main():
    sol = Solver({w for w in scowl_upto(35) if len(w) >= 3})
    for rack in sys.argv[1:] or ["aoprrsw"]:
        for clean in (False, True):
            words, total = path(sol, rack, clean)
            label = "clean" if clean else "par  "
            seq = " > ".join(f"{w}({score(w)})" for w in words)
            print(f"{rack} {label} {total:3d}: {seq}")


if __name__ == "__main__":
    main()
