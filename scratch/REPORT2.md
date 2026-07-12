# Out of Sorts Discovery Report, Pass 2: The Tail

Date: 2026-07-12. Scripts: `scratch/tail_analysis.py` (variant solver and sweep), `scratch/verify_variants.py` (naive cross-check and path printer). Raw numbers: `scratch/results_tail.json`. Full sweep, no sampling: all six (rack size, source band, common band) configs times four variants ran in 9.1 seconds. Every variant solver was cross-checked against a naive no-assumptions search on 19 racks times 4 variants: zero mismatches.

## Question 1 answer, plainly

**The tail is real and this pass matters.** On the baseline par path at 7 letters, pool sizes 3 and 4 account for **48 to 49% of all plays and 36 to 37% of all par points**. At 8 letters, 41 to 42% of plays and 29 to 30% of points. Pool sizes 3 and 4 are visited on more than 99% of par paths, and the player who chases depth mines them slightly harder than the player who chases score. Half the measured game is short-word mining. You were not pattern-matching off one example; SPARROW is typical, and PROFITS (below) is worse. The variants are not solutions in search of a problem.

## Conventions added this pass

- **Rung attribution.** A play belongs to the rung equal to its own length, which is the pool size it creates. Holds at size k and the drop into size k are both rung-k plays. "Mean words before dropping" at rung k is the mean number of anagram-class plays per visit to a size-k pool.
- **Variant semantics.** "At most one play at pool size k" is implemented as: the word that lands the pool at size k is the one play there, chosen as the class's best-scoring word, and holds at that size are banned. Under B a 3-letter play therefore ends the run (nothing is playable after it), which matches "the last word is the ending." The alternative reading (the drop-in word plus one hold) would leave a two-word mini mop-up at rung 3 and was rejected as against the stated intent.
- **Clean Descent per variant.** Ends at pool size 3 under A, B, D and at pool size 4 under C. No step drops more than one letter. Holds never break it (where they are legal).
- **Path reconstruction.** Optimal paths always play every legal hold (holds are free score and never change the pool), so a path is a chain of pool signatures. Drop ties are broken deterministically (lexicographically greatest signature).
- Everything else carries over from pass 1: cleaning, cumulative SCOWL bands, word-level gate denominators, rack-level stats over unique gate-surviving racks, raw ceiling with no curation.

## Question 1: tail profile, baseline rules

At (source 35, common 50), the design config. Other configs shift no cell by more than about 1.5 points; their grind totals are in the last table of this section.

**7 letters, par path (and longest-run path in parentheses):**

| Pool size | Share of plays | Share of points | Mean words before dropping |
|---|---|---|---|
| 7 | 12.0% (11.4%) | 18.9% (20.0%) | 1.19 (1.19) |
| 6 | 15.3% (14.3%) | 19.6% (19.5%) | 1.64 (1.67) |
| 5 | 24.1% (23.6%) | 25.2% (25.1%) | 2.46 (2.51) |
| 4 | 28.0% (29.1%) | 23.1% (22.9%) | 2.77 (3.03) |
| 3 | 20.6% (21.6%) | 13.1% (12.5%) | 2.04 (2.24) |

**8 letters, par path (longest-run in parentheses):**

| Pool size | Share of plays | Share of points | Mean words before dropping |
|---|---|---|---|
| 8 | 9.0% (8.5%) | 15.0% (16.0%) | 1.11 (1.11) |
| 7 | 10.7% (9.6%) | 14.9% (14.6%) | 1.48 (1.50) |
| 6 | 15.8% (15.3%) | 18.4% (18.9%) | 2.09 (2.16) |
| 5 | 23.1% (22.8%) | 22.4% (22.1%) | 2.92 (3.02) |
| 4 | 24.3% (25.4%) | 19.0% (18.6%) | 3.01 (3.34) |
| 3 | 17.2% (18.4%) | 10.2% (9.8%) | 2.13 (2.41) |

Two readings. First, the mining is bottom-heavy but not only terminal: rung 4 is the single biggest rung by plays at both rack sizes, bigger than rung 3. Second, the longest-run path is slightly grindier than the par path at rungs 3 and 4 and nowhere else, which confirms the interpretation note: depth-chasing IS mining, and a high word count is not evidence of a good session.

**Grind share (rungs 3 plus 4 combined), baseline A, par path:**

| Config | Share of plays | Share of par points |
|---|---|---|
| 7L (35, 35) | 48.8% | 36.2% |
| 7L (35, 50) | 48.5% | 36.3% |
| 7L (50, 50) | 49.0% | 36.7% |
| 8L (35, 35) | 42.2% | 29.5% |
| 8L (35, 50) | 41.4% | 29.2% |
| 8L (50, 50) | 41.8% | 29.6% |

Band config barely moves it. Rack size moves it a little (8 letters dilutes the tail with more top rungs) but does not fix it.

## Question 2: rule variants, side by side

All tables at both rack sizes and all three configs. Variant columns: A baseline, B terminal three, C minimum four, D hold floor.

**Gate survival (words, % of raw source pool):**

| Config | A | B | C | D |
|---|---|---|---|---|
| 7L (35, 35), n=6,720 | 4,127 (61.4%) | 4,127 (61.4%) | 4,147 (61.7%) | 4,127 (61.4%) |
| 7L (35, 50), n=6,720 | 4,590 (68.3%) | 4,590 (68.3%) | 4,609 (68.6%) | 4,590 (68.3%) |
| 7L (50, 50), n=9,600 | 6,237 (65.0%) | 6,237 (65.0%) | 6,267 (65.3%) | 6,237 (65.0%) |
| 8L (35, 35), n=6,526 | 3,016 (46.2%) | 3,016 (46.2%) | 3,023 (46.3%) | 3,016 (46.2%) |
| 8L (35, 50), n=6,526 | 3,521 (54.0%) | 3,521 (54.0%) | 3,525 (54.0%) | 3,521 (54.0%) |
| 8L (50, 50), n=10,138 | 5,161 (50.9%) | 5,161 (50.9%) | 5,168 (51.0%) | 5,161 (50.9%) |

This surprised me and it is structural, not coincidence. **A, B, and D have identical gates because holds never affect whether a clean drop chain exists**; the variants only ban holds, so Clean Descent feasibility is untouched. And **C's gate is a strict superset of A's**: its Clean Descent ends at pool 4, needing one fewer transdeletion, and any A-clean rack is automatically C-clean. The feared disqualifier for C does not exist; it GAINS a handful of racks (about 20 at 7 letters). Every cell remains years of dailies before curation (worst cell 3,016 words, roughly 8 years raw). The rule variants cost nothing at the gate. The tradeoffs are all elsewhere.

**Depth (min / median / max, longest run, over survivors):**

| Config | A | B | C | D |
|---|---|---|---|---|
| 7L (35, 35) | 5 / 9 / 23 | 5 / 8 / 21 | 4 / 7 / 20 | 5 / 6 / 18 |
| 7L (35, 50) | 5 / 10 / 26 | 5 / 9 / 23 | 4 / 8 / 22 | 5 / 7 / 19 |
| 7L (50, 50) | 5 / 10 / 26 | 5 / 9 / 23 | 4 / 8 / 22 | 5 / 7 / 19 |
| 8L (35, 35) | 6 / 12 / 24 | 6 / 11 / 22 | 5 / 10 / 21 | 6 / 9 / 19 |
| 8L (35, 50) | 6 / 13 / 28 | 6 / 11 / 25 | 5 / 10 / 24 | 6 / 9 / 21 |
| 8L (50, 50) | 6 / 13 / 28 | 6 / 11 / 25 | 5 / 10 / 24 | 6 / 9 / 21 |

Depth buckets at (35, 50), share of survivors:

| Longest run | 7L A | 7L B | 7L C | 7L D | 8L A | 8L B | 8L C | 8L D |
|---|---|---|---|---|---|---|---|---|
| <= 5 | 1.6% | 4.9% | 16.2% | 21.0% | 0.0% | 0.0% | 1.5% | 0.0% |
| 6 - 8 | 31.2% | 42.0% | 43.8% | 55.1% | 10.2% | 17.1% | 26.3% | 40.5% |
| 9 - 11 | 36.5% | 33.6% | 28.0% | 18.1% | 29.4% | 33.0% | 34.6% | 36.6% |
| 12 - 14 | 19.9% | 14.0% | 7.9% | 4.5% | 30.7% | 31.5% | 24.3% | 16.1% |
| 15+ | 10.8% | 5.4% | 4.0% | 1.3% | 29.7% | 18.4% | 13.3% | 6.8% |

**Teeth (% of survivors where par is not a Clean Descent / median gap as % of par when diverging):**

| Config | A | B | C | D |
|---|---|---|---|---|
| 7L (35, 35) | 12.0 / 9.1 | 11.0 / 9.0 | 8.7 / 11.1 | 7.2 / 9.3 |
| 7L (35, 50) | 11.4 / 10.2 | 11.1 / 9.8 | 9.0 / 10.9 | 6.4 / 10.4 |
| 7L (50, 50) | 12.1 / 10.5 | 11.7 / 10.1 | 9.8 / 11.4 | 6.8 / 10.9 |
| 8L (35, 35) | 19.0 / 10.1 | 17.9 / 10.7 | 16.7 / 10.7 | 14.2 / 9.6 |
| 8L (35, 50) | 18.6 / 10.1 | 18.1 / 10.0 | 16.9 / 10.7 | 13.6 / 10.7 |
| 8L (50, 50) | 19.0 / 10.7 | 18.8 / 10.5 | 17.2 / 11.5 | 14.3 / 11.0 |

The second big finding of the pass: **the grind and the teeth are entangled.** D nearly halves divergence at 7 letters (11.4% to 6.4%) because a large share of greed decisions ARE "break the ladder to reach a minable short cluster." Kill the mine and the decision often disappears with it. B keeps the teeth nearly intact (11.4% to 11.1%) precisely because it barely touches the mine.

**Full-rack hold rate (over survivors):**

| Config | A | B | C | D |
|---|---|---|---|---|
| 7L (35, 35) | 10.6% | 10.6% | 10.5% | 10.6% |
| 7L (35, 50) | 15.1% | 15.1% | 15.0% | 15.1% |
| 7L (50, 50) | 12.3% | 12.3% | 12.2% | 12.3% |
| 8L (35, 35) | 6.4% | 6.4% | 6.4% | 6.4% |
| 8L (35, 50) | 9.8% | 9.8% | 9.8% | 9.8% |
| 8L (50, 50) | 7.7% | 7.7% | 7.6% | 7.7% |

Variant-invariant, as expected (full-rack holds are pool size 7 or 8, legal everywhere). Note the config effect, discussed under question 3.

**Par (median / mean):**

| Config | A | B | C | D |
|---|---|---|---|---|
| 7L (35, 35) | 60 / 62.8 | 57 / 59.8 | 52 / 55.1 | 50 / 52.5 |
| 7L (35, 50) | 64 / 68.1 | 61 / 64.5 | 56 / 59.7 | 54 / 56.2 |
| 7L (50, 50) | 64 / 67.9 | 61 / 64.1 | 56 / 59.3 | 54 / 55.7 |
| 8L (35, 35) | 80 / 81.9 | 77 / 78.8 | 72 / 74.2 | 68 / 70.3 |
| 8L (35, 50) | 85 / 89.4 | 82 / 85.4 | 77 / 80.8 | 72 / 76.0 |
| 8L (50, 50) | 85 / 89.4 | 82 / 85.4 | 77 / 80.7 | 72 / 75.7 |

**Grind (share of plays / share of points at rungs 3 plus 4, par path), with absolute plays per run in brackets [grind plays of total plays]:**

| Config | A | B | C | D |
|---|---|---|---|---|
| 7L (35, 35) | 48.8 / 36.2 [4.5 of 9.1] | 43.1 / 32.6 [3.6 of 8.3] | 36.3 / 26.8 [2.7 of 7.4] | 29.4 / 22.0 [2.0 of 6.7] |
| 7L (35, 50) | 48.5 / 36.3 [4.8 of 9.9] | 42.1 / 32.2 [3.7 of 8.8] | 35.4 / 26.6 [2.8 of 8.0] | 27.8 / 20.9 [2.0 of 7.2] |
| 7L (50, 50) | 49.0 / 36.7 [4.8 of 9.8] | 42.6 / 32.6 [3.7 of 8.8] | 35.8 / 27.0 [2.8 of 7.9] | 28.0 / 21.1 [2.0 of 7.1] |
| 8L (35, 35) | 42.2 / 29.5 [4.8 of 11.4] | 36.4 / 26.1 [3.8 of 10.4] | 30.5 / 21.4 [2.9 of 9.6] | 22.8 / 15.9 [2.0 of 8.7] |
| 8L (35, 50) | 41.4 / 29.2 [5.1 of 12.4] | 35.1 / 25.4 [4.0 of 11.3] | 29.3 / 21.0 [3.0 of 10.4] | 21.2 / 14.9 [2.0 of 9.4] |
| 8L (50, 50) | 41.8 / 29.6 [5.2 of 12.4] | 35.4 / 25.7 [4.0 of 11.3] | 29.6 / 21.3 [3.1 of 10.4] | 21.3 / 15.0 [2.0 of 9.4] |

**The share metric misleads here, and I am flagging it rather than smoothing it.** The grind share does not collapse under B, C, or D the way the prompt expected, because banning holds shrinks the whole path, denominator included. The absolute numbers show what actually happens: at 7L (35, 50) the baseline plays 4.8 short words per run; B removes about one (3.7 remain, because B only touches rung 3 and rung 4 is the bigger mine); C removes two (2.8 remain, all at rung 4, where it still allows unlimited holds); D caps it at 2.0 by construction, one four and one three, which is the design intent stated as a number. Only D kills the grind. B trims the mop-up ending and nothing else. C deletes a rung without fixing the mill.

## Question 3: band config, first-class

Every table above carries all three configs. The summary reading:

- **(35, 50) is the best cell at 7 letters and it is not close.** Gate 68.3% (4,590 words, about 12.5 years raw). Full-rack hold rate 15.1%, the highest of any config at either rack size, against 10.6% at (35, 35) and 12.3% at (50, 50). Teeth 11.4% under baseline. The mechanism for the hold bump: band-35 source words are common words, and common words have more anagram partners once the ladder dictionary widens to 50 (EIPRSST gains SPRITES, ADEEGNR gains GRANDEE). (50, 50) dilutes the source pool with obscurer words that have fewer partners.
- (50, 50) buys a bigger raw pool (6,237 words at 7L) and nothing else; every quality metric is equal or slightly worse than (35, 50).
- Band config has almost no effect on the tail, the grind, or the variant tradeoffs; those are rules effects, not dictionary effects. Rack size and variant are the two levers that matter.

## Question 4: the felt difference

Par paths at (35, 50), 7 letters. Note baseline SPARROW par is 79 here, not the 74 of pass 1, because the common band is 50 now (ASP enters the pool).

**SPARROW (aoprrsw), the prompt's exhibit:**

- A, par 79: sparrow(12) > warps(10) > wraps(10) > paws(9) > swap(9) > wasp(9) > asp(5) > pas(5) > sap(5) > spa(5)
- B, par 67: sparrow(12) > warps(10) > wraps(10) > paws(9) > swap(9) > wasp(9) > paw(8)
- C, par 59: sparrow(12) > warps(10) > wraps(10) > paws(9) > swap(9) > wasp(9)
- D, par 49: sparrow(12) > warps(10) > wraps(10) > wasp(9) > paw(8)

**SCALLOP (acllops):**

- A, par 76: scallop(11) > claps(9) > clasp(9) > scalp(9) > laps(6) > pals(6) > slap(6) > asp(5) > pas(5) > sap(5) > spa(5)
- B, par 61: scallop(11) > claps(9) > clasp(9) > scalp(9) > laps(6) > pals(6) > slap(6) > spa(5)
- C, par 56: scallop(11) > claps(9) > clasp(9) > scalp(9) > laps(6) > pals(6) > slap(6)
- D, par 53: scallop(11) > claps(9) > clasp(9) > scalp(9) > caps(8) > cap(7)

**PROFITS (fioprst), my pick for the worst of the grind.** This is the rack family (O, P, S, T cores: PISTOLS, PROTONS, SPROUTS, IMPORTS all behave the same) with the largest par loss from A to D, and the baseline path is the whole indictment in one line:

- A, par 92: profits(12) > tripos(8) > ports(7) > sport(7) > strop(7) > opts(6) > post(6) > pots(6) > spot(6) > stop(6) > tops(6) > opt(5) > pot(5) > top(5)
- B, par 82: profits(12) > tripos(8) > ports(7) > sport(7) > strop(7) > opts(6) > post(6) > pots(6) > spot(6) > stop(6) > tops(6) > top(5)
- C, par 77: profits(12) > tripos(8) > ports(7) > sport(7) > strop(7) > opts(6) > post(6) > pots(6) > spot(6) > stop(6) > tops(6)
- D, par 52: profits(12) > tripos(8) > ports(7) > sport(7) > strop(7) > tops(6) > top(5)

Fourteen words at baseline, nine of them the OPTS/POST/POTS/SPOT/STOP/TOPS/OPT/POT/TOP mill. B removes two of the nine. **C removes three and keeps the six-word rung-4 mill fully intact, which is the decisive exhibit against C: the mill is made of 4-letter words, and a 4-letter minimum does not touch it.** D collapses it to tops > top.

**PERSIST (eiprsst), my pick for what D preserves.** Five 7-letter anagrams, four 6-letter, three 5-letter: the discovery rack.

- A, par 120: persist(9) > priests(9) > spriest(9) > sprites(9) > stripes(9) > priest(8) > ripest(8) > sprite(8) > stripe(8) > piers(7) > pries(7) > spire(7) > pier(6) > ripe(6) > per(5) > rep(5)
- D, par 109: same thirteen words through spire(7), then rips(6) > sip(5)

D costs PERSIST 9% of its par and none of its identity. The DESPAIR moment lives at pool sizes 5 and up, and D does not touch it. Meanwhile SCALLOP under D does something genuinely new: it abandons the LAPS/PALS/SLAP mill and ends caps(8) > cap(7), keeping the C for value. Under D the endgame words are chosen for what they are worth, not for how many anagrams they have. That is the felt difference in one path.

## Surprises, called out

1. **The gate is variant-proof.** A, B, D identical to the word, structurally (holds cannot affect clean-descent existence), and C is a strict superset, plus about 20 racks. I flagged C as the variant that might disqualify itself at the gate; the opposite is true. C's costs are elsewhere.
2. **B does not kill the grind and C does not either.** Rung 4 is a bigger mine than rung 3 (28% of plays vs 21% at 7 letters). B only touches rung 3 and removes about one play per run. C deletes rung 3 entirely and then permits unlimited 4-letter milling; PROFITS keeps its whole six-word mill. Only D, which was designed as the surgical option, actually is one: exactly 2.0 short words per run, everywhere, by construction.
3. **Killing the grind kills half the teeth at 7 letters.** D takes divergence from 11.4% to 6.4%. The two-letter-drop-to-a-minable-cluster move is not just where the tedium lives, it is where much of the greed decision lives. B keeps 11.1% because it keeps the mine. This is the real tradeoff of the pass: B preserves the decision structure and most of the tedium; D removes the tedium and a large piece of the decision.
4. **8 letters with variant D is the quiet winner cell that neither of us named in advance.** Teeth 13.6% at (35, 50), higher than the 7-letter baseline's 11.4%, with grind capped at 2.0 words, median run 9 words of honest composition, full-rack hold 9.8%, gate 3,521 words (about 9.6 years raw). If D is the variant, the rack-size argument flips toward 8: the extra rung restores the decision density that D removes at 7.
5. **The longest-run path mines harder than the par path.** Depth-chasing is grinding; a word-count metric rewards exactly the behavior the variants are trying to remove. Whatever variant ships, word count should probably not be a surfaced score.

## The tradeoff, read out

- **B (terminal three)** is the cheap trim: nothing lost at the gate, teeth intact, par barely moves, and the run now ends on a chosen word (SPARROW ends on paw(8), not spa). But 3.7 of 8.8 plays per run are still short-word mining, and PROFITS still plays the mill. If the tail profile at rung 4 is acceptable game feel, B is nearly free.
- **C (minimum four)** is dominated. It costs the most par and depth of any variant, its supposed gate cost turned out to be a gate gain, and it still leaves 2.8 mill words per run because the mill is made of 4-letter words. There is no metric in this sweep on which C beats both B and D. My prior agreed with yours that C would be too expensive at the gate; it is instead just outclassed.
- **D (hold floor)** is the variant that produces the game the design doc describes: every reconstructed path reads as a descent, the big-anagram discovery is untouched, and the endgame becomes a value choice (caps > cap) instead of a mop-up. The bill is real: at 7 letters, teeth drop to 6.4% (one choice day in 16) and mean par flattens from 68 to 56. At 8 letters the bill mostly vanishes: teeth 13.6%, above the 7-letter baseline.
- The pairing to take seriously, on these numbers: **D at 8 letters, (35, 50)**, or **B at 7 letters, (35, 50)** if the rung-4 mill is judged tolerable in playtesting. The numbers cannot make that last call; it is about how OPTS/POST/POTS feels on a phone at rung 4, and that is a playtest question.

## Standing caveats

Still no etymology gate, no lemma culling, no hand review, no calendar, no gate enforcement. Every count is an optimistic ceiling on a raw pool and shrinks from here. Scratch scripts only; nothing in this pass is engine code; `eight-letters` untouched.
