# Out of Sorts

The GDD is the source of truth for design and lives at
`../vault/Projects/Out of Sorts/GDD.md`. Read it before any design-affecting
work. Do not copy it into this repo.

A daily word game about attrition. A run starts with **eight scrambled
letters, and nothing more**; each play's letters become the new pool; every
letter you did not use is gone for good; no repeats; the run ends when no
legal, unplayed, valid word can be formed. Score is the Scrabble value sum
of each word played, which equals each letter's value times the number of
words it survived in.

**There is no source word.** The Cut (GDD v0.4) removed it: an eight letter
word here is the opening move, not a hidden crown, and a rack may spell up
to five of them. Seeds enumerate racks and are never surfaced; two anagram
seeds are the same day. If you find yourself reasoning about a crown, a
lemma rule, or an etymology gate, you are working from a dead draft.

The whole game ships: engine, solver, data bake, calendar, cold start, and
UI. The design was settled by four measured discovery passes; the reports
live in `scratch/` and the numbers in `scratch/results_*.json`.

## Load-bearing rules (breaking any of these breaks the game)

- **Classic SCOWL v1 (2020.12.07), never ESDB.** ESDB dropped the size 95
  band the validation boundary depends on. The raw lists are vendored in
  `data/raw/` with provenance. Never download SCOWL; use the committed files.
- **Par is common-pool only. Never the validation boundary.** The true
  optimum over the boundary exceeds par on 100.0 percent of racks, roughly
  doubling it. The boundary's job is generous acceptance during play; it is
  never the yardstick. The solver only ever receives the common index.
- **The boundary ACCEPTS. The common pool DECIDES.** `isLegalPlay` reads
  `valid` (the boundary), so an off-pool word is still playable and still
  scores. `hasLegalPlay`, which sets `run.ended`, reads `common`. The run is
  over when the player's vocabulary is spent, not when the last SCOWL 95
  obscurity has been mined out of the pool. End detection was judged on the
  boundary for six weeks while par, the gate, and Clean Descent were all
  judged on the common pool, so 72 percent of real runs ended with the player
  hitting Stop and being told "Rested early." The line the game is named for
  was withheld from exactly the people who earned it. **Whenever two things
  here reason about what words exist, check they are asking the same
  dictionary.** End detection must also apply the endgame rule, not merely
  formability: under `descent` nothing is legal at a pool of three, and a
  formability-only check is correct under `mill` and silently wrong the
  moment the flag flips.
- **Bands are decoupled on purpose.** Rack seeds: SCOWL 35, length 8.
  Common pool: SCOWL 50. Seeding from band 35 guarantees every rack holds at
  least one findable eight letter word; the ladder stays generous at 50.
- **The gate is not configurable.** A rack becomes a day only if a Clean
  Descent exists for it using common-pool words only. Every daily is
  perfectible. The gate is invariant across endgame rules (pinned by tests);
  compute it through the solver, never reimplement it.
- **The endgame rule is a flag, not a decision.** `mill` (default),
  `terminal-three`, `descent`. It is one predicate in
  `src/engine/rules.ts`, threaded through play legality and solver banking.
  Never branch on the rule anywhere else. Do not hardcode a rule.
- **The bake pins are sacred.** Boundary 430,172; common 61,411 shipped;
  source 6,526. The common pool has two true numbers: 61,502 is the
  pre-filter cleaning stage every discovery statistic was measured against,
  and 61,411 is what ships after dropping the 91 one and two letter words
  that can never be played (minimum word length is 3). The engine applies
  the length filter at index build either way, so the sweep is identical
  under both; verify:sweep proves it. Any other drift means the cleaning
  changed and every GDD number is untrustworthy. Stop and report; never
  adjust the pin.
- **The data version is the cache key.** The bake emits
  `public/data/manifest.json` with a content hash of the baked lists. The
  runtime dictionary cache (IndexedDB) is keyed by it, so a re-bake
  invalidates stale caches automatically. A stale index silently rejects
  valid words, the worst failure mode in the game; never cache the index
  without the version check.
- **The verification sweep must stay green.** `pnpm verify:sweep` reproduces
  the Python discovery numbers exactly, all three rules, full population.
  Any mismatch is a bug, not a rounding difference.

## Analytics build flavour (F-Droid)

- The web build may carry Vercel Analytics. The F-Droid flavour must not
  contain the package at all: `pnpm run build:fdroid` compiles
  `__ANALYTICS__` to false so the import is dead code and absent from the
  bundle. `pnpm run check:flavour` proves it. Never convert this to a
  runtime toggle; F-Droid forbids proprietary analytics dependencies
  outright and reviewers read the source.
- No analytics, telemetry, ad SDKs, or trackers in the app bundle. This is
  a constraint on the dependency tree, not just a policy.
- Any future Android wrap must bundle the game locally (PWA or Capacitor),
  never a WebView pointed at the hosted site.

## Calendar rules

- **The committed calendar is APPEND-ONLY. Never reorder, never remove.**
  Day N is the entry at position N; changing an existing entry re-dates
  every day after it. New racks go on the end, forever. The generation
  script refuses to overwrite an existing calendar without --force, and
  --force means re-anchoring the calendar epoch (Peach's "genuine last
  reshuffle" is the cautionary tale).
- **A calendar entry is a rack, not a word.** The design (The Cut, GDD
  v0.4) removed the source word: anagram seeds are the same day, and the
  baked eights list exists so the scramble can avoid displaying a valid
  word before any dictionary loads.
- **The two epochs are decoupled.** STORAGE_EPOCH (src/calendar/epochs.ts)
  keys progress and streaks and NEVER MOVES; the calendar epoch lives in
  calendar.json and may be re-anchored by regeneration. Rollover is local
  midnight.
- **The gate goes through the engine's solver, never reimplemented.**
  Every calendar rack passes it (pinned by a test that walks the whole
  artifact), and Endless draws from the same pool.
- The denylist (data/denylist.json) flows into patch-deny.txt and the
  manifest hash. It affects the boundary only, never the common pool, so
  the sweep stays exact; the 15 racks where par leans on a denied word are
  a known, flagged tension.

## Testing rules learned the hard way

- **Synthetic-date tests cannot see a bad epoch. Anything derived from a
  committed artifact must be tested against the committed artifact.** The
  calendar shipped with an epoch a month in the future: `rackForDate`
  correctly returned null every single day, the UI clamped it to entry 0,
  and every daily anyone ever saw was Day 1. There were 150 tests,
  including a full timezone matrix and a day-N-maps-to-entry-N test, and
  not one asked the real calendar for today's rack. See
  `test/calendar-live.test.ts`.
- **Never substitute a plausible default for a null the engine returned
  deliberately.** A null is a fact. Clamping, defaulting, or falling back
  past one turns a loud failure into a game that looks fine and is wrong.
  Surface it: throw in dev, say something true in production.
- **jsdom has no layout engine.** Anything about size, position, wrapping,
  or overflow must be measured in a real browser; see
  `test/layout.test.ts`.

## Cold start rules

- **The dictionary index never blocks the rack.** The rack renders with no
  dictionary (`scrambleRack` takes a predicate, not the boundary). The index
  builds in a Web Worker (`src/loader/worker.ts`), lands whenever it lands,
  and the submit gate (`src/loader/submit-gate.ts`) queues any submit made
  before it is ready. Never reject a word because the dictionary was still
  loading, and never add a loading spinner that blocks play.
- **That rule is for a FRESH rack. A RESTORED run is the opposite case.**
  `run` needs `puzzle` needs `engine` needs the dictionary, so before it
  lands the game cannot know a returning player already finished (it painted
  a playable board, then flipped to the end screen) and a mid-run pool falls
  back to the entry's rack (it showed eight letters the player no longer
  owned, which is worse). The gate is exactly **restored words exist and
  there is no run yet** (`restoring` in `src/ui/useGame.ts`), never the
  dictionary in general. A fresh rack has nothing to restore, so nothing
  about it is unknowable, so it still paints in 0 to 2ms with no loading
  state at all. **If you find yourself blocking a fresh rack, the condition
  is wrong.** Both modes carry their own saved run and gate independently.
- **The restore says "Finding what you left." and it is never a spinner.**
  A line of text, in the game's face, and the fade is delayed 250ms, so a
  warm restore finishes before the line is ever painted and the player just
  sees their run. Only a genuinely slow restore says anything.
- **A mode switch cannot test the cold start.** By then the engine has
  landed. The flash only exists on a cold load, so the regression test seeds
  today's real daily from the committed calendar and watches with a
  MutationObserver installed before first paint (`test/layout.test.ts`). A
  version of that test written around a mode switch passed with the bug
  still in place.
- The built index is cached in IndexedDB keyed by the bake manifest version;
  see the data version rule above. The cache stores the dictionary index
  only; game progress is a later prompt.
- One build implementation: `buildFromTexts` in `src/loader/build.ts` is
  shared by the worker, any main thread fallback, and the Node loader. Do
  not fork it.

## UI rules (each one was learned by getting it wrong)

- **The board must never claim something the state does not support.** The
  cold tile read as disabled for two builds because every one of its signals
  was subtractive (pale fill, gray letter, sunk position), which is the
  universal vocabulary of a disabled control. **At risk is marked by
  ADDITION, never by removal.** Three tile states, one grammar: the ring
  carries the status (none, solid mint, dashed ghost violet) and the fill,
  the letter color, and the height are held constant.
- **A ghost means the letter is gone; a cold tile means it is about to be.**
  The ghost silhouette is reserved for the drift. Reference the color of
  loss, never the shape.
- **The pool display must never spell a valid word, at any size**: the
  opening eight (guarded by the calendar's baked list, before the dictionary
  loads), every redisplay after a drop, and every shuffle.
- **The pill is a length bar, not a container.** Row width is a pure
  function of word length and rack size, shared by every stack on screen.
  Scores live in a fixed gutter beside the stack. Never widen a pill to fit
  its contents: that lies about word length, and the silhouette is the whole
  basis of the comparison and the share. **No decoration may enter the width
  basis.** A ring, a dash, an inset or a padding that changes what a letter
  is worth in pixels breaks every column at once. Pinned by
  `test/scale.test.ts`, which asserts width over length is one number for
  the whole screen. Suspected twice, measured false twice: an outline is
  painted outside the border box and cannot move layout, and a white pill
  with a drop shadow merely LOOKS wider than a flat grey one of equal width.
  **Measure before you believe it. A screenshot is not a measurement.**
- **One mint, one job, one grammar.** Mint is the eights. In the stacks the
  eights are marked by an inset mint ring, the same ring in every column,
  and the fill and letter color are held constant: the fill already carries
  yours versus possible. This is the tiles' grammar (the ring carries the
  status, marked by addition) and it is now the stack's. The reveal chip
  keeps a mint fill because it is a different kind of object. A solid mint
  bar was the loudest thing on the end screen, louder than the headline. If
  the ring ever reads as too quiet, the fix is a heavier ring or a second
  mark, **never a return to the fill.** The ring is inset, so it can never
  be clipped and can never touch the width basis.
- **Never raise the OS keyboard.** The word display is a display, not an
  input; typing is captured globally, and on a phone the tiles are the
  keyboard.
- **The cold preview fires on formability and length, never validity.**
  Gating it on validity would turn it into a dictionary oracle.
- **The peak gets a ceremony, and the ceremony is quiet.** All Eights fires
  on 9.8 percent of racks and it used to render as a chip in a row of chips.
  It now says so in words, before the score, with the eights revealed in
  mint and the run's ghosts gathered above them. No confetti, no bounce, no
  sparkle, no exclamation mark: if it reads as perky it has failed, and
  failing that way is worse than doing nothing. On a single-eight rack none
  of it exists. **Absence, never failure.**
- **"Out of sorts." is the idiom, not the title.** The line never changes,
  but it must never be SET like the masthead: it shipped in violet Baloo at
  2rem six inches under a violet Baloo 1.9rem title, and a stranger read a
  duplicate heading. Plum, body face, italic, smaller. Pinned by a test that
  compares the two computed styles.
- **The focus ring is designed, and it is violet.** It was whatever the
  browser picked, and on the Endless chip that was amber, which is banned.
  A focus ring is not an automation artifact; keyboard users see it
  constantly. Global `:focus-visible`, and a test sweeps the rendered styles
  for anything in the amber band.
- **The page must never move when you share.** Both button labels live in
  one grid cell so the swap to "Copied." costs no reflow. `navigator.share`
  where it exists, clipboard where it does not, always feature-detected and
  never sniffed. A cancelled sheet copies nothing: the player declined.

## Working conventions

- pnpm. TypeScript strict. Vite and Vitest. TDD: failing test first.
- Conventional Commits. No em dashes anywhere: commits, comments, docs.
- **Shipped prose must pass `../vault/Voice/AI Tells.md`.** In particular,
  **"quiet" and its family of self-flattering mood adjectives are banned
  outright** (gentle, thoughtful, lovingly, elegant, delightful, and
  simple/small/considered/careful used as praise). They claim the feeling
  the work should earn; if the thing is quiet the reader will find it quiet.
  **Delete them, do not replace them.** "A daily word game about loss" is the
  whole line. Pinned for the link preview by `test/meta-assets.test.ts`. Not
  the tell: the word doing real descriptive work about something other than
  the product's own merit (a code comment specifying a sound as quiet, a
  dictionary word in the baked lists).
- `pnpm test`, `pnpm typecheck`, `pnpm lint`, `pnpm build` before commit
  (husky runs lint-staged and typecheck on commit).
- The Python scripts in `scratch/` are the frozen reference, not shipping
  code. Do not port them; verify against them. Do not touch
  `../eight-letters`.

## Commands

- `pnpm bake` regenerates `public/data/` from `data/raw/` (offline, exact).
- `pnpm verify:sweep` runs the cross-language acceptance sweep.
- `pnpm bench` measures dictionary load and puzzle creation times.
- `pnpm run check:flavour` proves the F-Droid bundle is analytics-free.

## What is deliberately not here

- **An ungated Run mode** (random rack, no perfectibility promise). A v1.1
  candidate on the same engine; it would muddy the v1 promise.
- **A second theme.** Ghosts carries the whole game. Not a theme system.
- **A backend, or cross-device sync.** Local storage in v1.
- **A definitions bake.**
- **Curation beyond the denylist.** The Cut removed the need for a lemma
  rule and an etymology gate entirely; do not reintroduce them.

## Open, and playtest-shaped

- **The endgame rule.** `mill` ships. Fully measured, and the taste is not:
  at five letters with A-P-S-W-O, is playing PAWS, SWAP, WASP a pleasure or
  a chore? The flag exists so a week of dailies can answer it.
- **Rank tier names and thresholds.** Provisional.
