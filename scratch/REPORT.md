# Out of Sorts Discovery Report: Ladder Solver And Rack Size

Date: 2026-07-12. Scripts: `scratch/ladder_analysis.py` (solver and sweep), `scratch/verify_solver.py` (brute-force cross-check), `scratch/show_paths.py` (path reconstruction). Raw numbers: `scratch/results.json`.

## The headline, question 3 first

**The badge model survives. The divergence is real and not near zero.**

Over gate-surviving racks, the par-scoring path is itself a Clean Descent on 88% of 7-letter racks and 81% of 8-letter racks. Which means the player must choose between the badge and the score on **12% of 7-letter racks and 19% of 8-letter racks**, at either common band. When they diverge, the gap is meaningful: median 5 to 8 points, which is 9 to 11% of par at the median, 18% at the 75th percentile, and up to 50% at the extreme.

| | 7 @ 35 | 7 @ 50 | 8 @ 35 | 8 @ 50 |
|---|---|---|---|---|
| Par path is a Clean Descent | 88.0% | 87.9% | 81.0% | 81.0% |
| Par requires breaking Clean Descent | 12.0% | 12.1% | 19.0% | 19.0% |
| Gap when diverging, points (median / mean / max) | 5 / 7.1 / 37 | 6 / 8.0 / 44 | 7 / 9.8 / 45 | 8 / 11.0 / 57 |
| Gap as % of par (median / p75 / max) | 9.1 / 17.5 / 50.7 | 10.5 / 18.6 / 53.2 | 10.1 / 17.7 / 48.9 | 10.6 / 18.3 / 46.2 |

The designed scenario exists in the wild, and SPARROW is a textbook case. Reconstructed at band 35:

- Par path, 74 points: sparrow(12) > warps(10) > wraps(10) > paws(9) > swap(9) > wasp(9) > pas(5) > sap(5) > spa(5). The second play drops two letters (O and an R) to keep W and P and ride the anagram-dense WARPS class.
- Best clean path, 37 points: sparrow(12) > arrows(9) > roars(5) > oars(4) > soar(4) > oar(3). Discipline keeps the ladder but sheds W and P early and dies on cheap letters.

Exactly half the score, for the badge. Other big diverging racks at 7 letters: SCALLOP (71 vs 35), PEANUTS (76 vs 47), MOTIVES (76 vs 49), ORPHANS (71 vs 44). At 8 letters: PARTAKES (131 vs 74 at band 50), SNAKIEST (119 vs 70), MERRIEST (114 vs 66).

One honest caveat in the other direction: on roughly 7 of 8 days (7-letter) the two badges align, so the tension is an event, not a constant. If you want teeth every day, that argues for 8 letters (1 in 5 days) or for deliberately overweighting diverging racks in the calendar later. But as a model, the three badges measure different things. The data says so.

## Conventions (used everywhere below)

- **Word cleaning.** Lowercase, keep only `^[a-z]+$`. This drops SCOWL possessive entries (`abacus's`), hyphenations, and diacritics. SCOWL files read as ISO-8859-1.
- **SCOWL bands are cumulative.** Size N = union of `english-words.*` and `american-words.*` at every band <= N. Classic SCOWL v1, version 2020.12.07, from SourceForge. Not ESDB; the size 95 band is present on disk, which confirms v1.
- **Validation boundary.** ENABLE union SCOWL 95, length >= 3. 430,172 words after cleaning. Used only for the true optimum.
- **Common pool.** SCOWL 35 (39,101 cleaned words) or SCOWL 50 (61,502), length >= 3, filtered to the current pool. Both reported everywhere.
- **Source pool.** In each column, the source pool and the common pool use the same band: at "7 @ 35" the sources are the 7-letter words of SCOWL 35. Raw ceiling: no lemma culling, no etymology gate, no hand review. Counts include plurals and inflections, so every number here is optimistic and the real crown pool will be smaller.
- **Play / Hold / Drop / Clean Descent / Par / True optimum.** As defined in the prompt. A run ends when no unplayed common word can be formed (for the common-only questions). A common-only Clean Descent is also a Clean Descent under the full validation boundary, since any leftover valid plays at a 3-letter pool are holds and cannot break it.
- **Words vs racks.** Gate survival is reported per source word (the prompt's denominator) and per unique rack (anagram sources share a rack). All other questions are over unique gate-surviving racks.
- **Hold counting.** A rack "carries a hold at pool size k" if some sub-multiset of size k has 2 or more common words in its anagram class. Every such class is reachable, because any of its words can be the first play (or, at the full rack, it is the start). The full-rack anagram count includes all full-length words, so ADEIPRS counts 4.
- **Greedy tie-break.** Longest word, then highest Scrabble value, then alphabetically first.
- Scrabble values, standard English, as specified.

## Step 0: inventory of ../eight-letters

Raw lists vendored there, all in `scripts/data-raw/`:

| Path | Lines | What it is |
|---|---|---|
| `scripts/data-raw/enable1.txt` | 172,823 | ENABLE list, public domain, ASCII |
| `scripts/data-raw/scowl/english-words.{10,20,35,40,50,55,60,70,80,95}` | 4,373 / 7,951 / 36,103 / 6,391 / 23,796 / 6,233 / 13,438 / 33,270 / 139,209 / 219,489 | Classic SCOWL v1 2020.12.07 bands, common to all English variants, ISO-8859-1, includes possessives |
| `scripts/data-raw/scowl/american-words.{same bands}` | 36 / 173 / 1,068 / 229 / 800 / 227 / 550 / 1,314 / 4,572 / 2,941 | Same, American-specific additions |

Provenance per its `PROVENANCE.md`: ENABLE from dolph/dictionary; SCOWL from `downloads.sourceforge.net/project/wordlist/SCOWL/2020.12.07`. **Confirmed classic v1, not ESDB.**

Present but deliberately NOT copied (baked or design-bearing): `public/data/scowl95-additions.txt`, `public/data/dictionary-patch.tsv`, `public/data/common-pool.txt`, `public/data/beyond-size-70.txt`, `public/data/beyond-size-95.txt`, `scripts/data-raw/source-exclusions.tsv`, `scripts/data-raw/definitions.tsv`, `scripts/data-raw/scowl95-proper-noun-warts.txt`, `scripts/source-exclude.txt`, and everything under `scripts/.cache/` and `scripts/_investigate/`.

Copied into `out-of-sorts/data/raw/`: `enable1.txt` plus all 20 SCOWL band files, with a provenance README. `out-of-sorts` initialized as a git repo and committed. Nothing in `eight-letters` was touched.

## Method and runtime

Exhaustive solve. The prompt's feared anagram-permutation explosion collapses analytically: a hold never changes the pool and always adds positive score, so every optimal path (for score, clean status, or length) plays all available holds before dropping. The search state therefore reduces to the pool signature alone, with each anagram class's summed score banked on arrival, and pool values are global per dictionary rather than per rack. No caps were needed anywhere; no rack blew up.

This was verified: a naive exhaustive search with state (pool, played set) and no assumptions was run on 44 racks (40 random plus ADEIPRS, SPARROW, ADEHRST, SCALLOP) and matched the fast solver on par, best clean score, and max run length with zero mismatches.

Runtime for the entire sweep, all four combos including true-optimum solves against the 430k-word validation boundary: **7.6 seconds total, 0.14 to 0.30 ms per rack**. Full sweep, no sampling.

## 1. Gate survival

Source words admitting a common-only Clean Descent:

| | 7 @ 35 | 7 @ 50 | 8 @ 35 | 8 @ 50 |
|---|---|---|---|---|
| Raw source words | 6,720 | 9,600 | 6,526 | 10,138 |
| Gate survivors (words) | 4,127 | 6,237 | 3,016 | 5,161 |
| **Survival %** | **61.4%** | **65.0%** | **46.2%** | **50.9%** |
| Unique surviving racks | 3,666 | 5,425 | 2,808 | 4,741 |

Cross-cut with the source pool fixed at SCOWL 35 and only the common band widened to 50: 68.3% of 7-letter sources survive, 54.0% of 8-letter.

Calendar math: every cell fills a daily calendar for years. Even the worst cell (8 @ 35) has 3,016 words / 2,808 racks, more than 7 years of dailies before any curation. But these are raw ceilings including plurals and inflections; the etymology gate, lemma rule, and hand review will only shrink them. At 7 letters you start with roughly 4,100 to 6,200 candidates, at 8 with roughly 3,000 to 5,200. Neither rack size is eliminated by the gate. The prior that 8 would be cut hard is directionally right (five consecutive transdeletions cost about 15 survival points versus 7 letters) but it is not fatal.

## 2. Depth distribution

Longest achievable run (words played, common only), over gate-surviving racks:

| | 7 @ 35 | 7 @ 50 | 8 @ 35 | 8 @ 50 |
|---|---|---|---|---|
| min | 5 | 5 | 6 | 6 |
| median | 9 | 10 | 12 | 13 |
| max | 23 | 26 | 24 | 28 |

Buckets (share of surviving racks):

| Longest run | 7 @ 35 | 7 @ 50 | 8 @ 35 | 8 @ 50 |
|---|---|---|---|---|
| <= 6 | 14% | 9% | 0.4% | 0.2% |
| 7 - 8 | 28% | 24% | 14% | 10% |
| 9 - 10 | 27% | 26% | 22% | 18% |
| 11 - 12 | 16% | 19% | 23% | 21% |
| 13 - 15 | 12% | 14% | 28% | 30% |
| 16+ | 3% | 8% | 12% | 21% |

A 7-letter minimum clean ladder is 4 words plus holds; observed minimum 5. Median runs are long enough that a daily is a real session at either size. 8-letter racks play noticeably deeper.

## 3. The teeth question

Reported up top. Summary: divergence 12% at 7 letters, 19% at 8, median gap around 10% of par, tail to 50%. The badges do not collapse. The scoring model has a decision in it.

## 4. Greedy-longest

Tie-break as stated: longest, then highest value, then alphabetical.

| | 7 @ 35 | 7 @ 50 | 8 @ 35 | 8 @ 50 |
|---|---|---|---|---|
| Greedy hits par | 17.3% | 15.7% | 8.8% | 8.4% |
| Greedy achieves Clean Descent | 83.1% | 86.1% | 75.4% | 80.2% |

Greedy-longest misses par on more than 4 of 5 racks at 7 letters and on more than 9 of 10 at 8 letters. The game is not a vocabulary lookup; there is a real strategy layer.

But note the inversion, which surprised me: greedy-longest is accidentally a **discipline** strategy, not a greed strategy. Playing the longest available word usually drops one letter at a time and lands a Clean Descent 75 to 86% of the time, while achieving par only 8 to 17% of the time. Par comes from milking anagram classes and choosing which letters to keep, not from word length. So the intuitive play style earns the Clean Descent badge and underperforms on Rank, which is a healthy shape: the obvious strategy gets you the discipline badge, and greed requires actual planning.

## 5. Holds

| | 7 @ 35 | 7 @ 50 | 8 @ 35 | 8 @ 50 |
|---|---|---|---|---|
| Racks with >= 1 hold anywhere | 99.0% | 99.5% | 99.9% | 99.9% |
| Hold at pool size 3 | 88.6% | 94.9% | 95.5% | 98.3% |
| Hold at pool size 4 | 95.2% | 96.3% | 99.2% | 99.3% |
| Hold at pool size 5 | 72.9% | 78.6% | 87.5% | 92.3% |
| Hold at pool size 6 | 38.8% | 42.9% | 67.3% | 72.3% |
| Hold at pool size 7 | 10.6% | 12.3% | 30.1% | 34.6% |
| Hold at pool size 8 | n/a | n/a | 6.4% | 7.7% |
| Full-rack hold (>= 2 full-length words) | 388 racks, 10.6% | 665, 12.3% | 181, 6.4% | 363, 7.7% |

Distribution of full-length word count per surviving rack (1 = source word only):

| Full-length words | 7 @ 35 | 7 @ 50 | 8 @ 35 | 8 @ 50 |
|---|---|---|---|---|
| 1 | 3,278 | 4,760 | 2,627 | 4,378 |
| 2 | 325 | 548 | 158 | 318 |
| 3 | 54 | 91 | 20 | 36 |
| 4 | 8 | 22 | 2 | 6 |
| 5 | 1 | 4 | 1 | 3 |

Interpretation: holds at pool sizes 3 to 5 are near universal because short anagram classes are dense, so "found a hold anywhere" cannot be a badge, it would fire every day. The full-rack hold is the rare discovery moment (6 to 12% of racks) and is the right definition for the badge. Also worth internalizing: milking a whole anagram class before dropping is THE core scoring mechanism. The par path for ADEHRST opens with all five 7-letter anagrams before dropping a letter.

Top ten racks by full-rack anagram count (ties broken by total ladder hold opportunities), candidates for deliberate calendar placement:

7-letter, band 50: AELPRSY (5: parleys, parsley, players, replays, sparely), ADEHRST (5: dearths, hardest, hatreds, threads, trashed), EIPRSST (5: persist, priests, spriest, sprites, stripes), ADEEGNR (5: angered, derange, enraged, grandee, grenade), AEIPRST (4: parties, pastier, pirates, traipse), ACELPRS (4: carpels, parcels, placers, scalper), ACENRST (4: canters, recants, scanter, trances), ADEIPRS (4: aspired, despair, diapers, praised), AEIRSTT (4: artiest, artiste, attires, tastier), DEIORST (4: editors, sortied, steroid, storied).

At band 35 the 7-letter list is similar but tighter: ADEHRST still leads with 5; ACENRST, ADEIPRS, AGILNST, EIPRSST, ADEEGNR, EILNSST, EERSSTT, EEERRSV have 4; AEIPRST drops to 3.

8-letter, band 50: AEGINRST (5: angriest, gantries, ingrates, rangiest, tasering), AEINRRST (5: restrain, retrains, strainer, terrains, trainers), AEGILNRT (5: alerting, altering, integral, relating, triangle), AEINPRST (4: painters, pantries, pertains, repaints, plus 159 ladder hold opportunities, the richest rack found), DEEINRST (4: inserted, nerdiest, resident, trendies), CENORSTU (4: construe, counters, recounts, trounces), ADEOPRRT (4: parroted, predator, prorated, teardrop), AEEIRSTT (4: iterates, teariest, treaties, treatise), AEELMNSS (4: lameness, maleness, nameless, salesmen), AEIPRSST (3: pastries, raspiest, traipses).

## 6. Par shape and the true optimum

Par distribution over gate-surviving racks:

| | 7 @ 35 | 7 @ 50 | 8 @ 35 | 8 @ 50 |
|---|---|---|---|---|
| min | 25 | 25 | 39 | 40 |
| p25 / median / p75 | 50 / 60 / 72 | 54 / 64 / 78 | 67 / 80 / 93 | 72 / 85 / 102 |
| max | 173 | 187 | 184 | 211 |
| mean | 62.8 | 67.9 | 81.9 | 89.4 |

Gap between true optimum (ENABLE union SCOWL 95) and par:

| | 7 @ 35 | 7 @ 50 | 8 @ 35 | 8 @ 50 |
|---|---|---|---|---|
| Racks where true optimum > par | 100.0% | 100.0% | 100.0% | 100.0% |
| Gap, median / mean / max | 74 / 78.5 / 219 | 67 / 70.0 / 207 | 102 / 106.3 / 277 | 91 / 95.2 / 246 |

This one is loud: the obscure tail adds more than par itself. The true optimum is roughly double par at the median, on literally every rack, all four combos. If par were defined against the validation boundary, no human would ever approach it and Rank would be meaningless. Par must stay common-pool-only, and this confirms it emphatically. It also means the validation boundary is doing exactly its job: generous acceptance for play, never the yardstick.

## Surprises, called out

1. **Widening the common band raises the survival rate even as it hardens the source pool.** 7-letter survival goes 61.4% at 35 to 65.0% at 50 while the source pool grows from 6,720 to 9,600. More common words means more ladder routes, and that beats the influx of harder source words. With sources fixed at band 35, common 50 lifts survival to 68.3% (7L) and 54.0% (8L).
2. **Greedy-longest is a discipline strategy, not a greed strategy** (83% clean, 17% par at 7 @ 35). The naive expectation that long words equal high score is wrong; holds and letter retention are where the score is.
3. **The true optimum beats par on 100.0% of racks, roughly doubling it.** I expected a large gap, not a universal one.
4. **Holds are effectively universal** at small pool sizes, so the Holds badge only means something if it is defined at or near the full rack.
5. **8 letters is more alive than the prior suggested.** The gate costs about 15 points of survival versus 7 letters, but 8-letter racks have sharper teeth (19% vs 12% divergence), deeper runs (median 13 vs 10), and a stronger anti-greedy profile (greedy hits par 8% vs 16%). The tradeoff: full-rack holds are rarer (7 - 8% vs 11 - 12%) and the raw crown pool is smaller. The numbers do not force 7. They frame a real choice: 7 is friendlier and hold-richer, 8 is deeper and tenser.

## What this pass did not do, on purpose

No etymology gate, no lemma culling, no hand review, no calendar, no daily word selection, no gate enforcement. Every count above is an optimistic ceiling on a raw pool; the next pass (curation) only shrinks it. The scratch scripts are throwaway and live in `scratch/`; nothing here is engine code.
