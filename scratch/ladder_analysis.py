#!/usr/bin/env python3
"""Out of Sorts discovery: ladder solver and rack size analysis.

Scratch analysis script. Not game code. See report for conventions.

Conventions:
- Word cleaning: lowercase, keep only ^[a-z]+$ (drops SCOWL possessives,
  hyphens, diacritics). SCOWL files read as ISO-8859-1.
- SCOWL size N = union of english-words.* and american-words.* bands <= N.
- Validation boundary = ENABLE union SCOWL 95, length >= 3.
- Common pool (per band B in {35, 50}) = SCOWL B, length >= 3.
- Source pool (per band B, length L in {7, 8}) = SCOWL B words of length L.
- Play: unplayed word, len >= 3, formable from current pool (sub-multiset).
- After a play, pool := letters of the played word.
- Hold: play whose letters == entire current pool. Drop: play that shrinks it.
- Clean Descent: run ends with pool of exactly 3 letters and no step dropped
  more than one letter. Holds do not break it.
- Par: max score with common-pool words only. True optimum: max score over
  the validation boundary.
- Key solver fact: a hold adds positive score and never changes the pool, so
  every optimal path (score / length / clean) plays ALL available holds
  before dropping. State therefore collapses to the pool signature alone and
  values are global per dictionary. No caps needed; the anagram-order
  explosion collapses analytically.
"""

import itertools
import json
import re
import statistics
import time
from collections import defaultdict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"

VALUES = {
    "a": 1, "b": 3, "c": 3, "d": 2, "e": 1, "f": 4, "g": 2, "h": 4,
    "i": 1, "j": 8, "k": 5, "l": 1, "m": 3, "n": 1, "o": 1, "p": 3,
    "q": 10, "r": 1, "s": 1, "t": 1, "u": 1, "v": 4, "w": 4, "x": 8,
    "y": 4, "z": 10,
}

WORD_RE = re.compile(r"^[a-z]+$")
NEG = float("-inf")
SCOWL_BANDS = [10, 20, 35, 40, 50, 55, 60, 70, 80, 95]


def score(w):
    return sum(VALUES[c] for c in w)


def load_file(path, encoding):
    out = set()
    with open(path, encoding=encoding) as f:
        for line in f:
            w = line.strip().lower()
            if WORD_RE.fullmatch(w):
                out.add(w)
    return out


def scowl_upto(n):
    words = set()
    for band in SCOWL_BANDS:
        if band > n:
            continue
        for prefix in ("english-words", "american-words"):
            words |= load_file(RAW / "scowl" / f"{prefix}.{band}", "latin-1")
    return words


class Solver:
    """Global-memo ladder solver for one dictionary."""

    def __init__(self, words):
        classes = defaultdict(list)
        for w in words:
            if len(w) >= 3:
                classes["".join(sorted(w))].append(w)
        self.classes = {s: tuple(sorted(ws)) for s, ws in classes.items()}
        self.classsum = {s: sum(score(w) for w in ws)
                         for s, ws in self.classes.items()}
        self.memo = {}

    def playable_subsigs(self, pool, strict):
        """Signatures q (len>=3) with words, q sub-multiset of pool."""
        top = len(pool) if not strict else len(pool) - 1
        seen = set()
        for k in range(3, top + 1):
            seen.update(itertools.combinations(pool, k))
        return ["".join(c) for c in seen if "".join(c) in self.classes]

    def eval_pool(self, pool):
        """(V, C, L) = best future (score, clean-score, word-count) from
        `pool`, AFTER all holds of pool's own class have been milked.
        C is NEG if no clean completion exists."""
        hit = self.memo.get(pool)
        if hit is not None:
            return hit
        drops = self.playable_subsigs(pool, strict=True)
        if not drops:
            res = (0, 0 if len(pool) == 3 else NEG, 0)
        else:
            v = l = 0
            c = NEG
            n = len(pool)
            for q in drops:
                qv, qc, ql = self.eval_pool(q)
                gain = self.classsum[q]
                v = max(v, gain + qv)
                l = max(l, len(self.classes[q]) + ql)
                if len(q) == n - 1 and qc != NEG:
                    c = max(c, gain + qc)
            res = (v, c, l)
        self.memo[pool] = res
        return res

    def solve_rack(self, rack_sig):
        base = self.classsum.get(rack_sig, 0)
        base_n = len(self.classes.get(rack_sig, ()))
        v, c, l = self.eval_pool(rack_sig)
        par = base + v
        best_clean = (base + c) if c != NEG else None
        return par, best_clean, base_n + l

    def greedy(self, rack_sig):
        """Play longest word; ties: highest score, then alphabetical."""
        pool = rack_sig
        played = set()
        total = words = 0
        clean = True
        while True:
            cands = [w for q in self.playable_subsigs(pool, strict=False)
                     for w in self.classes[q] if w not in played]
            if not cands:
                break
            w = min(cands, key=lambda w: (-len(w), -score(w), w))
            played.add(w)
            total += score(w)
            words += 1
            if len(w) < len(pool) - 1:
                clean = False
            pool = "".join(sorted(w))
        return total, words, clean and len(pool) == 3

    def hold_profile(self, rack_sig):
        """Hold opportunities: sub-multiset signatures with >= 2 words.
        Any such signature is reachable (its first word can always be the
        play that lands there; at the full rack, it is the start)."""
        sizes = set()
        opps = 0
        for q in self.playable_subsigs(rack_sig, strict=False):
            n = len(self.classes[q])
            if n >= 2:
                sizes.add(len(q))
                opps += n - 1
        return sizes, opps, len(self.classes.get(rack_sig, ()))


def pct(a, b):
    return 100.0 * a / b if b else 0.0


def dist(xs):
    if not xs:
        return {}
    xs = sorted(xs)
    return {
        "min": xs[0],
        "p25": xs[len(xs) // 4],
        "median": statistics.median(xs),
        "p75": xs[3 * len(xs) // 4],
        "max": xs[-1],
        "mean": round(statistics.mean(xs), 2),
    }


def main():
    t0 = time.time()
    enable = load_file(RAW / "enable1.txt", "ascii")
    scowl35 = scowl_upto(35)
    scowl50 = scowl_upto(50)
    scowl95 = scowl_upto(95)
    validation = {w for w in (enable | scowl95) if len(w) >= 3}
    print(f"enable={len(enable)} scowl35={len(scowl35)} "
          f"scowl50={len(scowl50)} scowl95={len(scowl95)} "
          f"validation(len>=3)={len(validation)}")

    solvers = {
        35: Solver({w for w in scowl35 if len(w) >= 3}),
        50: Solver({w for w in scowl50 if len(w) >= 3}),
    }
    truth = Solver(validation)

    results = {}
    for L in (7, 8):
        for band in (35, 50):
            t_combo = time.time()
            sol = solvers[band]
            source_words = sorted(w for w in (scowl35 if band == 35
                                              else scowl50) if len(w) == L)
            racks = defaultdict(list)
            for w in source_words:
                racks["".join(sorted(w))].append(w)

            per_rack = {}
            for sig in racks:
                par, best_clean, maxlen = sol.solve_rack(sig)
                g_score, g_words, g_clean = sol.greedy(sig)
                hold_sizes, hold_opps, full_anas = sol.hold_profile(sig)
                true_par, _, _ = truth.solve_rack(sig)
                per_rack[sig] = dict(
                    par=par, best_clean=best_clean, maxlen=maxlen,
                    greedy_score=g_score, greedy_words=g_words,
                    greedy_clean=g_clean, hold_sizes=sorted(hold_sizes),
                    hold_opps=hold_opps, full_anas=full_anas,
                    true_par=true_par,
                )

            surv_sigs = [s for s, r in per_rack.items()
                         if r["best_clean"] is not None]
            surv_words = sum(len(racks[s]) for s in surv_sigs)
            S = [per_rack[s] for s in surv_sigs]

            # Q3 teeth
            par_clean = [r for r in S if r["best_clean"] == r["par"]]
            diverge = [r for r in S if r["best_clean"] != r["par"]]
            gaps = [r["par"] - r["best_clean"] for r in diverge]
            gap_pcts = [100.0 * g / r["par"]
                        for g, r in zip(gaps, diverge)]

            # Q4 greedy
            greedy_par = [r for r in S if r["greedy_score"] == r["par"]]
            greedy_clean = [r for r in S if r["greedy_clean"]]

            # Q5 holds
            any_hold = [r for r in S if r["hold_opps"] > 0]
            full_hold = [r for r in S if r["full_anas"] >= 2]
            holds_by_size = {
                k: sum(1 for r in S if k in r["hold_sizes"])
                for k in range(3, L + 1)}
            full_ana_dist = defaultdict(int)
            for r in S:
                full_ana_dist[r["full_anas"]] += 1
            top_holds = sorted(
                surv_sigs,
                key=lambda s: (-per_rack[s]["full_anas"],
                               -per_rack[s]["hold_opps"], s))[:10]

            # Q6 par shape + true optimum gap
            true_gaps = [r["true_par"] - r["par"] for r in S]

            depth_hist = defaultdict(int)
            for r in S:
                depth_hist[r["maxlen"]] += 1

            results[f"{L}@{band}"] = dict(
                source_words=len(source_words),
                unique_racks=len(racks),
                gate_words=surv_words,
                gate_words_pct=round(pct(surv_words, len(source_words)), 1),
                gate_racks=len(surv_sigs),
                gate_racks_pct=round(pct(len(surv_sigs), len(racks)), 1),
                depth=dist([r["maxlen"] for r in S]),
                depth_hist=dict(sorted(depth_hist.items())),
                q3_par_is_clean_pct=round(pct(len(par_clean), len(S)), 1),
                q3_diverge_pct=round(pct(len(diverge), len(S)), 1),
                q3_gap_points=dist(gaps),
                q3_gap_pct_of_par=dist([round(x, 1) for x in gap_pcts]),
                q4_greedy_hits_par_pct=round(pct(len(greedy_par),
                                                 len(S)), 1),
                q4_greedy_clean_pct=round(pct(len(greedy_clean),
                                              len(S)), 1),
                q5_any_hold_pct=round(pct(len(any_hold), len(S)), 1),
                q5_holds_by_pool_size={
                    k: round(pct(v, len(S)), 1)
                    for k, v in holds_by_size.items()},
                q5_full_rack_hold_racks=len(full_hold),
                q5_full_rack_hold_pct=round(pct(len(full_hold), len(S)), 1),
                q5_full_anagram_count_dist=dict(sorted(full_ana_dist.items())),
                q5_top_holds=[
                    dict(rack=s,
                         words=list(sol.classes.get(s, ())),
                         full_anas=per_rack[s]["full_anas"],
                         ladder_hold_opps=per_rack[s]["hold_opps"])
                    for s in top_holds],
                q6_par=dist([r["par"] for r in S]),
                q6_true_gap=dist(true_gaps),
                q6_true_gap_gt0_pct=round(
                    pct(sum(1 for g in true_gaps if g > 0), len(S)), 1),
                combo_seconds=round(time.time() - t_combo, 2),
                ms_per_rack=round(1000 * (time.time() - t_combo)
                                  / max(1, len(racks)), 3),
            )
            # biggest-gap examples for the report
            if diverge:
                ex = sorted(
                    (s for s in surv_sigs
                     if per_rack[s]["best_clean"] != per_rack[s]["par"]),
                    key=lambda s: -(per_rack[s]["par"]
                                    - per_rack[s]["best_clean"]))[:5]
                results[f"{L}@{band}"]["q3_examples"] = [
                    dict(rack=s, source=racks[s],
                         par=per_rack[s]["par"],
                         best_clean=per_rack[s]["best_clean"])
                    for s in ex]
            print(f"done {L}@{band}: {results[f'{L}@{band}']['combo_seconds']}s")

    results["total_seconds"] = round(time.time() - t0, 2)
    out = ROOT / "scratch" / "results.json"
    out.write_text(json.dumps(results, indent=2))
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
