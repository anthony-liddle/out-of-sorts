# Out of Sorts Discovery Report, Pass 4: The Crown

Date: 2026-07-12. Script: `scratch/crown_analysis.ts`, run against the verified TypeScript engine (no Python, no re-derived solver). Raw numbers: `scratch/results_crown.json`. Full population, no sampling. Method self-validated: the whole-population partition reproduces every pass 3 baseline exactly (grind 41.4 / 29.2, rung-5 mean 2.92, median depth 13, full-rack hold 9.8%, n = 3,300).

Every number below uses the heuristic classifier and is approximate by construction. It is a sizing tool, not a rule, and nothing in this report is final.

## Question 1, answered plainly

**Curation does not kill the mill. The mill is structural, and the endgame rule question stands exactly where pass 3 left it.**

Racks whose crown survives the heuristic rule have a grind share of **42.8% of plays / 30.2% of points**, against 41.0 / 28.9 for the racks curation removes and 41.4 / 29.2 for the whole population. Rung-5 mean words: 2.97 kept vs 2.90 removed. Median run length: 13 in both partitions. Every mill statistic is identical within noise, and the kept partition is if anything a hair grindier.

| Mill under `mill`, 8L (35, 50) | Population (n=3,300) | Kept crowns (n=751) | Removed crowns (n=2,549) |
|---|---|---|---|
| Grind share, plays / points | 41.4 / 29.2 | 42.8 / 30.2 | 41.0 / 28.9 |
| Mean words at rung 5 | 2.92 | 2.97 | 2.90 |
| Median run length | 13 | 13 | 13 |
| Rung profile (plays% at 8/7/6/5/4/3) | 9.0/10.7/15.8/23.1/24.3/17.2 | 8.4/10.3/15.5/22.9/24.8/18.0 | 9.1/10.9/15.9/23.1/24.2/17.1 |

The reason is obvious once measured: the mill lives at pool sizes 3 to 5, and the words down there do not know or care whether the 8-letter crown that spawned the rack was a plural. The crown determines the letters and nothing else.

**The pass 3 observation that launched this pass was a base-rate illusion, and that surprised me until the arithmetic did not.** Eight of the ten worst mill racks have inflected crowns, but 67.4% of ALL raw source words are heuristically inflected, and 77% of gate-surviving racks lose every crown to the rule. Chance alone predicts 7.7 of any 10 racks are inflected-crowned. Observed: 8. There was never a signal.

So the hoped-for outcome is dead: the endgame-rule debate does not dissolve, `mill` does not get a free pass, and per the step 0 rule, **Wiktionary data should not be acquired for mill reasons**. Whether it is worth acquiring for crown quality is a separate call that question 5 prices.

## Step 0: the heuristic and its error rate

Classifier: flag a word if it ends in -s (not -ss), -es, -ed, -ing, -er, or -est and a plausible stem (drop suffix, restore -e, undouble consonant, -i back to -y) is a boundary word. It flags 4,397 of 6,526 raw source words (67.4%), leaving 2,129 clean.

Sanity on the pass 3 top ten: DESPAIRS, SHARPEST, PANTHERS, PATTERNS, OPERANDS, CAPRICES, COMPARES, POACHERS flagged; REPRISAL and TAPESTRY clean. Exactly the 8/2 split pass 3 eyeballed. The prompt's false-positive worries behave as designed: BUSINESS and PROGRESS are not flagged (the -ss exclusion), INTEREST IS wrongly flagged (stem "inter"), the type specimen of the false-positive class.

Hand check of 50 flagged words (stride sample across the alphabet, listed in `results_crown.json`): **all 50 are genuine morphological inflections; zero hard false positives in the sample.** Five are borderline lexicalized forms that a Wiktionary-grade rule might keep as adjective or noun lemmas in their own right: ASSUREDS, CANKERED, DEFORMED, FATIGUES, RETARDED. So the sample false-positive rate is 0% under a strict morphology standard and roughly 10% under a generous lexicalization standard. One caveat that matters at this scale: with 4,397 words flagged, even a 5 to 10% false-positive rate is 200 to 450 wrongly removed crowns, which is material to question 5's pool math.

## Question 2: the bill in holds

| | Population | Kept | Removed |
|---|---|---|---|
| Full-rack hold rate | 9.8% | 10.7% | 9.5% |
| Class size 2 / 3 / 4 / 5 racks | 279 / 35 / 6 / 3 | 65 / 8 / 5 / 2 | 214 / 27 / 1 / 1 |

Of the 323 hold-carrying racks, **80 are rescued and 243 are lost (75%)**. Read that with question 1 in mind: the losses are not the price of killing the mill, because the mill does not die. They are the price of crown quality alone.

But the asymmetry you asked me to check explicitly does most of its work exactly where it matters: **the marquee racks survive.** Among the nine racks with 4 or 5 full-length words, seven are rescued by a clean crown in their own class and only two are genuinely lost:

- **Lost:** AEGINRST (the type specimen, as you predicted: its only source word is ANGRIEST, and GANTRIES / INGRATES / RANGIEST / TASERING offer no clean crown) and AEINPRST (PAINTERS / PANTRIES / PERTAINS / REPAINTS, all inflected).
- **Rescued:** AEGILNRT crowns TRIANGLE or INTEGRAL and keeps ALERTING / ALTERING / RELATING as finds. AEINRRST crowns RESTRAIN and keeps its four inflected partners. CENORSTU crowns CONSTRUE. DEEINRST crowns RESIDENT. AEELMNSS crowns NAMELESS or SALESMEN. ADEOPRRT crowns PREDATOR or TEARDROP. AEEIRSTT crowns TREATISE.

So the worry half-evaporates: the five-way discovery moments mostly keep a lemma to crown, and what the rule actually costs is the long tail of two-word hold racks (214 of the 243 losses are class-2). The exchange rate is: lose three quarters of ordinary hold racks, keep seven of the nine spectacular ones.

## Question 3: the S hypothesis, split verdict

| Mill stats | S racks (n=2,210) | No-S racks (n=1,090) |
|---|---|---|
| Grind share, plays / points | 41.0 / 29.1 | 42.6 / 29.5 |
| Mean words at rung 5 | **3.31** | **2.10** |
| Median run length | **14** | **10** |
| Full-rack hold rate | **11.3%** | 6.7% |

The hypothesis as stated is dead: S does not drive the grind share, which is flat everywhere (this genuinely surprised me; I expected S racks to mill harder as a share of play). What S actually buys is **depth and holds**: a full extra rung-5 mill word on average (3.31 vs 2.10), four more words of median run, and nearly double the full-rack hold rate. The grind share is scale-invariant; S makes the whole game longer, including its mill, in proportion. There is a calendar-rationing lever here for run-length pacing, not for grind. Reported, not proposed.

## Question 4: the endgame rule on the curated pool

Question 1 already settled this (the mill does not dissolve), but here is the confirmation, all three rules over the 751 kept racks:

| Curated pool, 8L (35, 50) | Mill | Terminal Three | Descent |
|---|---|---|---|
| Greedy hits par | 8.7% | **12.5%** | 26.5% |
| Teeth (par path not clean) | 20.4% | 19.8% | 15.7% |
| Median par | 84 | 80 | 70 |
| Grind share (plays / points) | 42.8 / 30.2 | 36.3 / 26.5 | 21.7 / 15.4 |
| Gate survival (curated words / racks) | 767 / 751 | same | same |

The shape is identical to the raw population: mill keeps its sharpness and its grind, descent keeps its cleanliness and its flatness, curation changes nothing structural. If anything the curated pool has slightly sharper teeth everywhere (20.4 vs 18.6 under mill). **The answer to the question you were hoping about: no. On a curated pool, mill's grind share is 42.8%, unchanged, and the endgame rule cannot simply not exist unless that grind is accepted as-is.** The decision remains the pass 2/3 decision, unchanged by curation, and still playtest-shaped.

**The owed number: Terminal Three's greedy par-hit rate is 10.7% on the full population** (12.5% on the curated pool). It sits where interpolation predicted, between mill's 8.3 and descent's 23.0, much closer to mill. Terminal Three preserves nearly all of mill's strategy depth while trimming only the final mop-up.

## Question 5: the pool, and the constraint fires

| Rule | Source words surviving gate + curation | Unique racks | Years of dailies |
|---|---|---|---|
| Raw gate only (baseline) | 3,521 | 3,300 | 9.6 |
| Heuristic lemma rule | 767 | 751 | **2.1** |
| Strict suffix bracket (harshest ceiling) | 631 | 616 | **1.7** |

**Saying it loudly, as instructed: a strict lemma rule leaves about two years of dailies BEFORE hand review, and hand review only shrinks it.** The heuristic sits exactly at your two-year line; the strict bracket is under it. The true Wiktionary-grade rule lands between the brackets, and the 5 to 10% borderline-lexicalized rate from step 0 might buy back one or two hundred words, not a multiple. A pool this thin is the hard constraint you named: strict crown curation at source 35 is unaffordable as a blanket rule.

One sizing footnote, because the constraint demanded it: widening the crown band to SCOWL 50 (8-letter, heuristically clean, gate-surviving) yields **1,357 words, about 3.7 years** pre-review. That trade (obscurer crowns for calendar depth) is a design decision, not mine, and it cuts against the reason the bands were decoupled in the first place.

## Surprises, called out

1. **The founding observation of this pass was a base-rate artifact.** 8 of 10 inflected top mill racks, against a 77% background rate. Four passes in, the habit of checking the denominator finally caught one of our own headlines.
2. **The mill is completely indifferent to curation.** Not "mostly survives": every statistic identical to within a point. The crown determines the letters; the letters below rung 5 belong to the whole language.
3. **The rescue asymmetry saves exactly the racks worth saving.** Seven of nine four-plus-word hold racks keep a clean crown. The lemma rule's real hold cost is the unglamorous class-2 tail.
4. **S buys depth, not grind share.** Grind is flat across the S partition while rung-5 milling, run length, and hold rate all swing hard. Wrong lever for the mill, real lever for pacing.
5. **The pool constraint, not the mill, is what curation actually decides.** The lemma rule was supposed to be a free crown-quality upgrade. At source 35 it costs three quarters of the calendar.

## What this closes and what it opens

Closed: the mill is not a curation artifact; the endgame rule decision is unchanged and still belongs to playtesting; Wiktionary acquisition is NOT justified by the mill (the step 0 gate said report before paying, and the heuristic says do not pay for this reason). Terminal Three's greedy number is on the record at 10.7%.

Open, and now priced: whether crown quality alone justifies a lemma rule that leaves a 2.1-year raw calendar at source 35, versus alternatives (a softer rule that only bans -s plurals, crown-band widening at 3.7 years, or hand review without a blanket rule). That is a design decision the GDD has to make before the first calendar is generated, because the calendar is append-only and Peach's reshuffle is the cautionary tale.

## Standing caveats

Heuristic classifier throughout; every number approximate by construction; do not treat as final, including me. No calendar generated, no curation enforced, no Wiktionary data acquired, no game code written, `eight-letters` untouched beyond reading its history earlier in the project. All counts remain optimistic ceilings pending hand review.
