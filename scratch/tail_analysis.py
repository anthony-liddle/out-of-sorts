#!/usr/bin/env python3
"""Out of Sorts discovery, pass 2: the tail, rule variants, band configs.

Scratch analysis. Reuses data loading and conventions from ladder_analysis.py.

Variant semantics (stated convention):
- A play of length k is "the one play at pool size k": the pool becomes those
  letters. Restricting pool size k to one play = banning holds at size k; the
  arriving word is the single play, chosen as the class's best-scoring word.
- B (terminal three): min length 3, no holds at pool size 3, so the first
  3-letter word ends the run.
- C (minimum four): min length 4, holds everywhere; run ends when no 4+ word
  is formable. Clean Descent ends at pool size 4.
- D (hold floor): min length 3, no holds at pool sizes 3 or 4. One word of
  length 4 and one of length 3 at most per run.
- Clean Descent terminal pool size = the variant's minimum word length
  (3 for A, B, D; 4 for C). No step may drop more than one letter; holds
  never break it.

Rung attribution: a play belongs to the rung equal to its own length, i.e.
the pool size it creates. Holds at size k and the drop into size k are both
rung-k plays. "Mean words before dropping" at rung k = mean anagram-class
plays per visit to a size-k signature on the reconstructed path.

Path reconstruction: optimal paths always milk every allowed hold (holds are
free score / length and never change the pool), so a path is a chain of
signatures; drop ties are broken by lexicographically greatest signature.
"""

import itertools
import json
import statistics
import sys
import time
from collections import defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
from ladder_analysis import load_file, scowl_upto, score, NEG, RAW

VARIANTS = {
    "A": dict(min_len=3, single=frozenset()),
    "B": dict(min_len=3, single=frozenset({3})),
    "C": dict(min_len=4, single=frozenset()),
    "D": dict(min_len=3, single=frozenset({3, 4})),
}

CONFIGS = [(L, sb, cb) for L in (7, 8) for (sb, cb) in
           ((35, 35), (35, 50), (50, 50))]


class VSolver:
    def __init__(self, words, min_len, single):
        self.min_len = min_len
        self.single = single
        classes = defaultdict(list)
        for w in words:
            if len(w) >= min_len:
                classes["".join(sorted(w))].append(w)
        self.classes = {s: tuple(sorted(ws)) for s, ws in classes.items()}
        self.gain = {}
        self.count = {}
        self.playlist = {}
        for s, ws in self.classes.items():
            if len(s) in single:
                best = max(ws, key=lambda w: (score(w), w))
                self.gain[s] = score(best)
                self.count[s] = 1
                self.playlist[s] = (best,)
            else:
                self.gain[s] = sum(score(w) for w in ws)
                self.count[s] = len(ws)
                self.playlist[s] = ws
        self.memo = {}

    def drops(self, pool):
        seen = set()
        for k in range(self.min_len, len(pool)):
            seen.update(itertools.combinations(pool, k))
        return ["".join(c) for c in seen if "".join(c) in self.classes]

    def eval_pool(self, pool):
        hit = self.memo.get(pool)
        if hit is not None:
            return hit
        qs = self.drops(pool)
        if not qs:
            res = (0, 0 if len(pool) == self.min_len else NEG, 0)
        else:
            v = l = 0
            c = NEG
            n = len(pool)
            for q in qs:
                qv, qc, ql = self.eval_pool(q)
                v = max(v, self.gain[q] + qv)
                l = max(l, self.count[q] + ql)
                if len(q) == n - 1 and qc != NEG:
                    c = max(c, self.gain[q] + qc)
            res = (v, c, l)
        self.memo[pool] = res
        return res

    def solve_rack(self, rack):
        base_g = self.gain.get(rack, 0)
        base_n = self.count.get(rack, 0)
        v, c, l = self.eval_pool(rack)
        par = base_g + v
        best_clean = (base_g + c) if c != NEG else None
        return par, best_clean, base_n + l

    def walk(self, rack, longest=False):
        """Signature chain of the par path (or longest-run path)."""
        pool = rack
        path = []
        while True:
            path.append(pool)
            qs = self.drops(pool)
            if not qs:
                return path
            if longest:
                pool = max(qs, key=lambda q: (self.count[q]
                                              + self.eval_pool(q)[2], q))
            else:
                pool = max(qs, key=lambda q: (self.gain[q]
                                              + self.eval_pool(q)[0], q))

    def profile(self, rack, longest=False):
        """Per-rung (plays, points, visits) along the reconstructed path."""
        per = {}
        for sig in self.walk(rack, longest):
            if sig not in self.classes:
                continue
            r = len(sig)
            p = per.setdefault(r, [0, 0, 0])
            p[0] += self.count[sig]
            p[1] += self.gain[sig]
            p[2] += 1
        return per

    def path_words(self, rack):
        out = []
        for sig in self.walk(rack):
            out.extend(self.playlist.get(sig, ()))
        return out


def dist(xs):
    xs = sorted(xs)
    return dict(min=xs[0], p25=xs[len(xs) // 4],
                median=statistics.median(xs),
                p75=xs[3 * len(xs) // 4], max=xs[-1],
                mean=round(statistics.mean(xs), 2))


def bucket(xs):
    edges = [(0, 5, "<=5"), (6, 8, "6-8"), (9, 11, "9-11"),
             (12, 14, "12-14"), (15, 99, "15+")]
    out = {}
    for lo, hi, name in edges:
        out[name] = round(100 * sum(1 for x in xs if lo <= x <= hi)
                          / len(xs), 1)
    return out


def main():
    t0 = time.time()
    scowl = {35: scowl_upto(35), 50: scowl_upto(50)}
    solvers = {(b, v): VSolver(scowl[b], **spec)
               for b in (35, 50) for v, spec in VARIANTS.items()}

    results = {}
    detail_paths = {}  # (7,35,50): rack -> paths under A and D, for Q4 picks
    for (L, sb, cb) in CONFIGS:
        sources = sorted(w for w in scowl[sb] if len(w) == L)
        racks = defaultdict(list)
        for w in sources:
            racks["".join(sorted(w))].append(w)
        for v in VARIANTS:
            t1 = time.time()
            sol = solvers[(cb, v)]
            surv = {}
            for sig in racks:
                par, best_clean, maxlen = sol.solve_rack(sig)
                if best_clean is None:
                    continue
                surv[sig] = (par, best_clean, maxlen)
            surv_words = sum(len(racks[s]) for s in surv)

            # per-rung aggregation on par path (all variants) and
            # longest path (variant A only, for Q1)
            rung_par = defaultdict(lambda: [0, 0, 0])
            rung_long = defaultdict(lambda: [0, 0, 0])
            for sig in surv:
                for r, (p, pts, vis) in sol.profile(sig).items():
                    a = rung_par[r]
                    a[0] += p
                    a[1] += pts
                    a[2] += vis
                if v == "A":
                    for r, (p, pts, vis) in sol.profile(
                            sig, longest=True).items():
                        a = rung_long[r]
                        a[0] += p
                        a[1] += pts
                        a[2] += vis

            def rung_table(agg):
                tp = sum(x[0] for x in agg.values())
                ts = sum(x[1] for x in agg.values())
                return {r: dict(
                    plays_pct=round(100 * agg[r][0] / tp, 1),
                    points_pct=round(100 * agg[r][1] / ts, 1),
                    mean_words=round(agg[r][0] / agg[r][2], 2),
                    visited_pct=round(100 * agg[r][2] / len(surv), 1),
                ) for r in sorted(agg, reverse=True)}

            tp = sum(x[0] for x in rung_par.values())
            ts = sum(x[1] for x in rung_par.values())
            grind_plays = 100 * sum(rung_par[r][0] for r in (3, 4)
                                    if r in rung_par) / tp
            grind_pts = 100 * sum(rung_par[r][1] for r in (3, 4)
                                  if r in rung_par) / ts

            pars = [surv[s][0] for s in surv]
            diverge = [(p - c, p) for (p, c, _) in surv.values() if p != c]
            gaps_pct = [100 * g / p for g, p in diverge]
            depth = [m for (_, _, m) in surv.values()]
            fullhold = sum(1 for s in surv
                           if len(sol.classes.get(s, ())) >= 2)

            key = f"{L}L src{sb} common{cb} {v}"
            results[key] = dict(
                source_words=len(sources),
                gate_words=surv_words,
                gate_words_pct=round(100 * surv_words / len(sources), 1),
                gate_racks=len(surv),
                depth=dist(depth), depth_buckets=bucket(depth),
                teeth_diverge_pct=round(
                    100 * len(diverge) / len(surv), 1),
                teeth_gap_pct_median=(round(statistics.median(gaps_pct), 1)
                                      if gaps_pct else 0.0),
                fullrack_hold_pct=round(100 * fullhold / len(surv), 1),
                par=dict(median=statistics.median(pars),
                         mean=round(statistics.mean(pars), 2)),
                grind_plays_pct=round(grind_plays, 1),
                grind_points_pct=round(grind_pts, 1),
                rungs_par=rung_table(rung_par),
                seconds=round(time.time() - t1, 2),
            )
            if v == "A":
                results[key]["rungs_longest"] = rung_table(rung_long)
            if (L, sb, cb) == (7, 35, 50) and v in ("A", "D"):
                for sig in surv:
                    detail_paths.setdefault(sig, {})[v] = dict(
                        par=surv[sig][0], path=sol.walk(sig))
            print(f"{key}: gate {results[key]['gate_words_pct']}% "
                  f"grind {results[key]['grind_plays_pct']}%/"
                  f"{results[key]['grind_points_pct']}% "
                  f"({results[key]['seconds']}s)")

    results["total_seconds"] = round(time.time() - t0, 2)
    (Path(__file__).parent / "results_tail.json").write_text(
        json.dumps(results, indent=2))

    # Q4 candidate picks: biggest par drop A->D, and preserved hold-rich rack
    both = {s: d for s, d in detail_paths.items() if "A" in d and "D" in d}
    drops_ad = sorted(both, key=lambda s: -(both[s]["A"]["par"]
                                            - both[s]["D"]["par"]))
    keep_ad = [s for s in both
               if both[s]["D"]["par"] >= 0.9 * both[s]["A"]["par"]]
    sol_a = solvers[(50, "A")]
    keep_rich = sorted(keep_ad,
                       key=lambda s: (-len(sol_a.classes.get(s, ())),
                                      -both[s]["A"]["par"]))
    picks = dict(
        biggest_drop=[dict(rack=s, parA=both[s]["A"]["par"],
                           parD=both[s]["D"]["par"]) for s in drops_ad[:10]],
        preserved_rich=[dict(rack=s, parA=both[s]["A"]["par"],
                             parD=both[s]["D"]["par"],
                             full_anas=len(sol_a.classes.get(s, ())))
                        for s in keep_rich[:10]],
    )
    (Path(__file__).parent / "q4_candidates.json").write_text(
        json.dumps(picks, indent=2))
    print(json.dumps(picks, indent=2))
    print(f"total {results['total_seconds']}s")


if __name__ == "__main__":
    main()
