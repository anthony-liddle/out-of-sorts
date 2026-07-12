# Out of Sorts Discovery Report, Pass 3: Greedy Under D

Date: 2026-07-12. Script: `scratch/greedy_d.py` (variant-aware greedy, divergence taxonomy, rung-5 check). Raw numbers: `scratch/results_greedy_d.json`. Config locked to (source 35, common 50) throughout; variants A and D only; both rack sizes. Full population, no sampling; the run takes about 15 seconds. Sanity check: the greedy simulator reproduces pass 1's numbers exactly (17.3% par, 83.1% clean at (35, 35), 7 letters, variant A).

One correction to the prompt's carried numbers, stated up front: pass 1's greedy cells (17.3% / 83.1% and 8.8% / 75.4%) were measured at (35, 35) and (8 @ 35), not at this pass's locked (35, 50). The config-matched baseline values are 15.8% / 85.9% at 7 letters and 8.3% / 80.2% at 8. The table below uses the config-matched numbers so every comparison is like for like.

## Question 1: the sentence you asked for first

**The greedy inversion survives variant D at both rack sizes: greedy-longest still earns the discipline badge far more often than it earns par (85.9% clean vs 41.1% par at 7 letters, 80.2% vs 23.0% at 8).** But at 7 letters it now survives inside a game with much less to decide, because the second thing this pass found is the one that moves the rack size:

| (35, 50), over gate survivors | 7L, A | 7L, D | 8L, A | 8L, D |
|---|---|---|---|---|
| Greedy hits par | 15.8% | **41.1%** | 8.3% | **23.0%** |
| Greedy achieves Clean Descent | 85.9% | 85.9% | 80.2% | 80.2% |
| Greedy score as % of par (median / p25) | 82.8 / 69.8 | **93.2 / 79.5** | 76.8 / 65.0 | **84.5 / 72.0** |

**At 7 letters, D flattens the strategy layer badly.** Greedy-longest hits par on two racks in five, and on the median rack it leaves only 6.8% of par on the table. That is close to the "strategy layer in name only" threshold you defined: a daily where the intuitive strategy is optimal 41% of the time and near-optimal most of the rest is much closer to a vocabulary lookup than the baseline game was. The mechanism is straightforward once seen: greedy never lost its points at the top of the ladder, it lost them by under-milking rungs 3 and 4. D deleted exactly the points greedy was missing, so par came down to meet the greedy player.

**At 8 letters, D lands almost exactly where the 7-letter baseline was.** 23.0% par-hit against 7L baseline's 15.8%; median greedy score 84.5% of par against 82.8%. The extra rung restores roughly the decision density that D removes. Combined with pass 2 (8L + D keeps teeth at 13.6%, above the 7L baseline's 11.4%), the two passes now say the same thing from independent directions.

A structural aside that surprised me before I saw why: greedy's Clean Descent rate is IDENTICAL under A and D, to the decimal, at both rack sizes. Not a coincidence. Banning holds never changes which drop greedy takes (holds only insert same-length words that cannot collide with the next drop choice), so greedy's drop skeleton, and therefore its cleanliness, is invariant across the variants. Only its score changes.

**Verdict on the open question: if D is the rule set, the rack is 8 letters.** Your prior (greedy still misses par badly under D, 7 stands) is contradicted at 7 letters and would have been discovered in playtest. This is the third structural result in the project that was findable in advance, and this time it was measured in advance.

## Question 2: did D delete junk decisions or real ones?

Population: the 469 racks (11.4%) that diverge under baseline A at 7 letters, (35, 50). D removes 264 of them (56%), keeps 205, and, a wrinkle worth knowing, **creates 56 new divergences**: racks that were clean-par under A become teeth racks under D, because the clean route lost its mop-up points and a two-letter drop now outscores it. Net: 264 + 205 + 56 gives D's 261 diverging racks (6.4%), matching pass 2.

Classification of the first two-plus-letter drop on the A par path. Two tests reported: the spec test exactly as you wrote it (the landing pool itself holds a 3+ word class at size 5 or below), and a path-aware test (the par path at or below the landing pool visits such a class), because the spec test turns out to systematically undercount the thing you meant:

| First non-clean step, 7L | Removed by D (n=264) | Kept by D (n=205) |
|---|---|---|
| Mine-seeking (spec / path-aware) | 31% / **63%** | 37% / 45% |
| Both mine and value (spec / path-aware) | 5% / **8%** | 10% / 15% |
| Value-seeking only (spec / path-aware) | 16% / 12% | 30% / 24% |
| Neither (spec / path-aware) | 46% / 14% | 18% / 10% |
| Ends high, no big drop (path stalls above pool 3) | 2% | 5% |

The spec test alone would have refuted your claim: only 36% of removed divergences land directly in a mine, and a 46% "neither" bucket dominates. But the neither bucket is mostly an artifact of where the drop LANDS versus where it is GOING: the canonical greed move lands one rung above its mill. SPARROW is the type specimen: the two-letter drop lands on WARPS/WRAPS (class of 2, not a mine by the spec test) precisely to reach the PAWS/SWAP/WASP mill one step below. The path-aware test resolves this, and under it **71% of the divergences D removed were mine-seeking (63% mine plus 8% both), against 12% purely value-seeking.** Your claim holds, with the caveat that the honest test had to be built, and with one real loss acknowledged: roughly one removed divergence in eight was a genuine letter-value decision.

The kept divergences shift toward value, as they should: 24% value-only and 15% both under the path-aware test, versus 12% and 8% among the removed. D keeps a larger share of the letter-keeping decisions and deletes a larger share of the milling ones.

Named examples per spec bucket (gap in points under A; "kept" means it still diverges under D):

- **Mine-seeking:** BABIEST / TABBIES (gap 44, kept), TERMING (31, kept), PEANUTS (31, kept: the PASTE/PATES/SPATE/TAPES mill).
- **Value-seeking:** SPARROW (42, kept, the type specimen as noted), GAZELLE (21, kept, keeping the Z), EVIDENT (21, kept).
- **Both:** SCALLOP (34, kept: CLAPS/CLASP/SCALP is a genuine 3-mine AND worth more per letter than the clean LOCALS route), DISPLAY (23, kept), TERMINI / INTERIM (21, kept).
- **Neither:** CANNIER (22, kept), ORPHANS (22, removed), NARROWS (22, removed).
- **Ends-high:** FILCHES (11, kept), HANKERS (11, removed), FINCHES (8, kept).

## Question 3: did the mill relocate to rung 5?

**No. The rung-5 mill is exactly as deep under D as it was under A, to the hundredth of a word.** Mean words played at rung 5 before dropping: 7 letters, 2.46 baseline, 2.46 under D. Eight letters, 2.92 baseline, 2.96 under D. The optimizer was already milking rung 5 maximally at baseline; D gives it no new reason or ability to milk harder. The cap is not being circumvented.

Par-path rung profile under D, with baseline A in parentheses:

**7 letters:**

| Pool size | Share of plays | Share of par points | Mean words before dropping |
|---|---|---|---|
| 7 | 16.6% (12.0%) | 23.0% (18.9%) | 1.19 (1.19) |
| 6 | 21.8% (15.3%) | 24.7% (19.6%) | 1.63 (1.64) |
| 5 | 33.9% (24.1%) | 31.5% (25.2%) | 2.46 (2.46) |
| 4 | 13.9% (28.0%) | 11.5% (23.1%) | 1.00 (2.77) |
| 3 | 13.9% (20.6%) | 9.3% (13.1%) | 1.00 (2.04) |

**8 letters:**

| Pool size | Share of plays | Share of par points | Mean words before dropping |
|---|---|---|---|
| 8 | 11.9% (9.0%) | 17.7% (15.0%) | 1.11 (1.11) |
| 7 | 14.4% (10.7%) | 18.0% (14.9%) | 1.48 (1.48) |
| 6 | 21.3% (15.8%) | 22.4% (18.4%) | 2.08 (2.09) |
| 5 | 31.2% (23.1%) | 27.0% (22.4%) | 2.96 (2.92) |
| 4 | 10.6% (24.3%) | 8.2% (19.0%) | 1.00 (3.01) |
| 3 | 10.6% (17.2%) | 6.7% (10.2%) | 1.00 (2.13) |

The new grind share (rungs 3 + 4 + 5 combined, par path): 7 letters, 61.7% of plays and 52.3% of points under D, versus 72.7% and 61.4% at baseline. Eight letters, 52.4% and 42.0% under D, versus 64.5% and 51.6%. Rung 5's SHARE rises under D (24.1% to 33.9% of plays at 7L) but that is pure denominator: the game got shorter and rung 5 stayed the same size. Whether rung 5 counts as "grind" at all is now a definitional question rather than a measured one: its mean is 2.46 five-letter words, and holds at 5 are the mechanic pass 2 explicitly chose to preserve. The measured claim is narrow and clean: D removed rungs 3 and 4 as mills and did not push the milling anywhere else.

**But D does have its own PROFITS, and it surprised me: it is DESPAIR.** The worst rung-5 offenders under D, top ten by rung-5 word count, at both rack sizes:

- 7 letters (all 7 rung-5 words): PATTERS/SPATTER, PARSECS/SCRAPES, ASPIRED/DIAPERS/PRAISED/DESPAIR, HAMPERS, PRANCES, REPEATS, TAMPERS, SHARPED, SPARSER, PAUPERS.
- 8 letters (all 7): DESPAIRS, REPRISAL, SHARPEST, PANTHERS, PATTERNS, OPERANDS, TAPESTRY, CAPRICES, COMPARES, POACHERS.

Every single one routes through the same class: AEPRS, which at common 50 holds seven words (PARES, PARSE, PEARS, RAPES, REAPS, SPARE, SPEAR), often after the six-word ADEPRS class (DRAPES, PADRES, PARSED, RASPED, SPARED, SPREAD). The three worst par paths under D:

- ADEIPRS, par 154: aspired(10) > despair(10) > diapers(10) > praised(10) > drapes(9) > padres(9) > parsed(9) > rasped(9) > spared(9) > spread(9) > pares(7) > parse(7) > pears(7) > rapes(7) > reaps(7) > spare(7) > spear(7) > reps(6) > rep(5). Nineteen words.
- ACEPRSS (PARSECS/SCRAPES), par 132: sixteen words, same AEPRS tail.
- AEPRSTT (PATTERS/SPATTER), par 102: fourteen words, same tail.

So the rack family the design celebrates for its four-way opener is also the deepest residual mill: the DESPAIR moment and the DESPAIR grind are the same letters. The saving fact is the distribution: on the D par path at 7 letters, 61.6% of racks play 2 or fewer words at rung 5, 10.8% play 5 or more, and the seven-word mills are 1.2% of racks, essentially all of them A-E-P-R-S supersets. At 8 letters the tail is fatter (18.9% play 5 or more, 2.2% hit seven). This is a tail phenomenon concentrated in one letter cluster, which makes it a curation and calendar problem (the crown pool can simply ration AEPRS-superset racks) rather than a rules problem. I am not proposing the fix, just noting the lever exists and is cheap.

## Surprises, called out

1. **D flattens 7 letters far more than the teeth number implied.** Greedy par-hit 15.8% to 41.1%, median greedy score 93.2% of par. The teeth metric measured badge conflict; this measured decisions; they disagreed by a factor of.. the pass existed because of exactly this gap, and the gap was real.
2. **Greedy's clean rate is variant-invariant, exactly.** 85.9% and 80.2% to the decimal under both A and D, because hold bans cannot change greedy's drop skeleton. The inversion (discipline easy, greed hard) is a property of the descent structure itself, not of the hold rules.
3. **The spec mine test would have wrongly refuted your Q2 claim.** The canonical greed move lands one rung above its mill (SPARROW lands on a class of two), so the landing-pool test says "neither" 46% of the time. Path-aware, 71% of what D removed was mine-seeking. The claim holds; the test as specified does not.
4. **D creates divergences too: 56 racks** are clean-par under A and teeth under D. The teeth number is not a subset relation; it is a rebalancing.
5. **D's residual mill is one letter cluster.** AEPRS accounts for every top-ten rung-5 offender at both rack sizes, DESPAIR(S) worst of all. Tail-sized (1 to 2% of racks), curation-addressable, and worth a line in the GDD's calendar rules.

## The read-out

D at 7 letters is a cleaner game with two fifths of its scoring decisions gone. D at 8 letters is a cleaner game that decides like the baseline 7-letter game did, with better teeth (13.6% vs 11.4%), an honest depth median of 9, grind capped at two short words, and a gate of 3,521 raw words at (35, 50), roughly 9.6 years of dailies before curation. Both passes now point the same way independently: **variant D, 8 letters, source 35, common 50.** The residual risks going into the GDD are playtest-shaped, not measurement-shaped: whether a 2.9-word rung-5 hold rhythm feels like discovery or like a smaller mill, and whether AEPRS-superset racks need rationing in the calendar.

## Standing caveats

Still no etymology gate, no lemma culling, no hand review, no calendar, no gate enforcement. Every count is an optimistic ceiling on a raw pool and only shrinks from here. Scratch scripts only; nothing here is engine code; `eight-letters` untouched. Measurement stops here.
