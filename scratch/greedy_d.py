#!/usr/bin/env python3
"""Pass 3: greedy-longest under variant D, divergence taxonomy, rung-5 check.

Config locked to (source 35, common 50), rack sizes 7 and 8, variants A and D.

Greedy tie-break (as pass 1): longest word, then highest Scrabble value,
then alphabetically first. Greedy respects variant rules: no holds at pool
sizes in the variant's restricted set.

Q2 classification of a diverging rack's par path, first step dropping >= 2
letters, landing pool q, from pool P:
- mine-seeking (spec test): class(q) has >= 3 words and |q| <= 5.
- value-seeking: letter-value sum of q exceeds that of every available
  one-letter-drop landing pool from P (vacuously true if none exist).
- both: passes both tests. neither: passes neither (reported honestly).
- ends-high: par path has no >= 2 drop at all; it diverges by getting stuck
  above pool size 3. Reported separately.
Secondary path-aware mine test: the par path AT OR BELOW q visits any class
with >= 3 words at size <= 5 (catches drops that land one rung above the
mill they are heading for, e.g. SPARROW's warps before the paws mill).
"""

import itertools
import json
import statistics
import sys
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ladder_analysis import scowl_upto, score, VALUES
from tail_analysis import VSolver, VARIANTS


def letters_val(sig):
    return sum(VALUES[c] for c in sig)


def greedy(sol, rack):
    pool = rack
    played = set()
    total = 0
    clean = True
    while True:
        cands = []
        seen = set()
        for k in range(sol.min_len, len(pool) + 1):
            seen.update(itertools.combinations(pool, k))
        for c in seen:
            q = "".join(c)
            if len(q) == len(pool) and len(pool) in sol.single:
                continue
            for w in sol.classes.get(q, ()):
                if w not in played:
                    cands.append(w)
        if not cands:
            break
        w = min(cands, key=lambda w: (-len(w), -score(w), w))
        played.add(w)
        total += score(w)
        if len(w) < len(pool) - 1:
            clean = False
        pool = "".join(sorted(w))
    return total, clean and len(pool) == 3


def main():
    s35, s50 = scowl_upto(35), scowl_upto(50)
    sols = {v: VSolver(s50, **VARIANTS[v]) for v in ("A", "D")}
    out = {}

    # sanity: reproduce pass 1 greedy at (35,35), 7L, variant A
    sol35 = VSolver(s35, **VARIANTS["A"])
    surv35 = [s for s in {"".join(sorted(w)) for w in s35 if len(w) == 7}
              if sol35.solve_rack(s)[1] is not None]
    h = c = 0
    for s in surv35:
        g, gc = greedy(sol35, s)
        h += g == sol35.solve_rack(s)[0]
        c += gc
    print(f"sanity (35,35) 7L A: greedy par {100*h/len(surv35):.1f}% "
          f"clean {100*c/len(surv35):.1f}%  (pass 1: 17.3 / 83.1)")

    racks_by_L = {}
    for L in (7, 8):
        racks = defaultdict(list)
        for w in s35:
            if len(w) == L:
                racks["".join(sorted(w))].append(w)
        racks_by_L[L] = racks
        surv = [s for s in racks
                if sols["A"].solve_rack(s)[1] is not None]
        for v, sol in sols.items():
            hits = clean = 0
            frac = []
            for s in surv:
                par = sol.solve_rack(s)[0]
                g, gc = greedy(sol, s)
                hits += (g == par)
                clean += gc
                frac.append(100 * g / par)
            frac.sort()
            out[f"q1 {L}L {v}"] = dict(
                greedy_par_pct=round(100 * hits / len(surv), 1),
                greedy_clean_pct=round(100 * clean / len(surv), 1),
                score_pct_median=round(statistics.median(frac), 1),
                score_pct_p25=round(frac[len(frac) // 4], 1),
                n=len(surv))
            print(f"q1 {L}L {v}: {out[f'q1 {L}L {v}']}")

    # Q2: divergence taxonomy at 7L under A; which does D remove?
    solA, solD = sols["A"], sols["D"]
    surv7 = [s for s in racks_by_L[7]
             if solA.solve_rack(s)[1] is not None]
    divA = {s for s in surv7
            if solA.solve_rack(s)[0] != solA.solve_rack(s)[1]}
    divD = {s for s in surv7
            if solD.solve_rack(s)[0] != solD.solve_rack(s)[1]}

    def classify(s):
        path = solA.walk(s)
        bad = None
        for P, q in zip(path, path[1:]):
            if len(q) < len(P) - 1:
                bad = (P, q)
                break
        if bad is None:
            return "ends-high", "ends-high"
        P, q = bad
        mine = len(solA.classes[q]) >= 3 and len(q) <= 5
        opts = solA.drops(P)
        one = [x for x in opts if len(x) == len(P) - 1]
        value = (not one) or letters_val(q) > max(letters_val(x)
                                                  for x in one)
        spec = ("both" if mine and value else "mine" if mine
                else "value" if value else "neither")
        i = path.index(q)
        mine_below = any(len(x) <= 5 and len(solA.classes[x]) >= 3
                         for x in path[i:])
        aware = ("both" if mine_below and value else
                 "mine" if mine_below else
                 "value" if value else "neither")
        return spec, aware

    tax = {s: classify(s) for s in divA}
    for group, name in ((divA - divD, "removed_by_D"),
                        (divA & divD, "kept_by_D")):
        spec_ct = defaultdict(int)
        aware_ct = defaultdict(int)
        for s in group:
            spec_ct[tax[s][0]] += 1
            aware_ct[tax[s][1]] += 1
        out[f"q2 {name}"] = dict(
            n=len(group),
            spec={k: f"{v} ({100*v/len(group):.0f}%)"
                  for k, v in sorted(spec_ct.items())},
            path_aware={k: f"{v} ({100*v/len(group):.0f}%)"
                        for k, v in sorted(aware_ct.items())})
        print(f"q2 {name}: {out[f'q2 {name}']}")
    out["q2 created_by_D"] = len(divD - divA)
    print(f"q2 created_by_D: {len(divD - divA)}")

    gapA = {s: solA.solve_rack(s)[0] - solA.solve_rack(s)[1] for s in divA}
    for bucket in ("mine", "value", "both", "neither", "ends-high"):
        ex = sorted((s for s in divA if tax[s][0] == bucket),
                    key=lambda s: -gapA[s])[:3]
        out[f"q2 examples {bucket}"] = [
            dict(rack=s, sources=racks_by_L[7][s], gap=gapA[s],
                 removed=s not in divD) for s in ex]

    # Q3: rung profile under D, rung-5 mean, grind345, worst rung-5 racks
    for L in (7, 8):
        surv = [s for s in racks_by_L[L]
                if solD.solve_rack(s)[1] is not None]
        for v, sol in sols.items():
            agg = defaultdict(lambda: [0, 0, 0])
            r5 = {}
            for s in surv:
                per = sol.profile(s)
                for r, (p, pts, vis) in per.items():
                    agg[r][0] += p
                    agg[r][1] += pts
                    agg[r][2] += vis
                r5[s] = per.get(5, [0, 0, 0])[0]
            tp = sum(x[0] for x in agg.values())
            ts = sum(x[1] for x in agg.values())
            out[f"q3 {L}L {v}"] = dict(
                rungs={r: dict(plays_pct=round(100 * agg[r][0] / tp, 1),
                               points_pct=round(100 * agg[r][1] / ts, 1),
                               mean_words=round(agg[r][0] / agg[r][2], 2))
                       for r in sorted(agg, reverse=True)},
                grind345_plays=round(100 * sum(agg[r][0] for r in (3, 4, 5)
                                               if r in agg) / tp, 1),
                grind345_points=round(100 * sum(agg[r][1] for r in (3, 4, 5)
                                                if r in agg) / ts, 1))
            print(f"q3 {L}L {v}: {out[f'q3 {L}L {v}']}")
            if v == "D":
                top = sorted(r5, key=lambda s: -r5[s])[:10]
                out[f"q3 worst rung5 {L}L D"] = [
                    dict(rack=s, sources=racks_by_L[L][s], rung5_words=r5[s])
                    for s in top]
                for s in top[:3]:
                    words = sol.path_words(s)
                    seq = " > ".join(f"{w}({score(w)})" for w in words)
                    par = sol.solve_rack(s)[0]
                    print(f"  worst {L}L {s} ({racks_by_L[L][s]}) "
                          f"par {par}: {seq}")

    (Path(__file__).parent / "results_greedy_d.json").write_text(
        json.dumps(out, indent=2))


if __name__ == "__main__":
    main()
