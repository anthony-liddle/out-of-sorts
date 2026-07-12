# Out of Sorts

A daily word game about attrition. A run starts with the eight scrambled
letters of a source word; each play's letters become the new pool; every
letter you did not use is gone for good; no repeats; the run ends when no
legal, unplayed, valid word can be formed. Score is the Scrabble value sum
of each word played, which equals each letter's value times the number of
words it survived in.

This repo currently ships the engine, the solver, and the data bake. No UI
yet. The design was settled by three measured discovery passes; the reports
live in `scratch/` and the numbers in `scratch/results_*.json`.

## Load-bearing rules (breaking any of these breaks the game)

- **Classic SCOWL v1 (2020.12.07), never ESDB.** ESDB dropped the size 95
  band the validation boundary depends on. The raw lists are vendored in
  `data/raw/` with provenance. Never download SCOWL; use the committed files.
- **Par is common-pool only. Never the validation boundary.** The true
  optimum over the boundary exceeds par on 100.0 percent of racks, roughly
  doubling it. The boundary's job is generous acceptance during play; it is
  never the yardstick. The solver only ever receives the common index.
- **Bands are decoupled on purpose.** Source words: SCOWL 35, length 8.
  Common pool: SCOWL 50. The crown must be recognizable; the ladder generous.
- **The gate is not configurable.** A source word may headline only if a
  Clean Descent exists for its rack using common-pool words only. Every
  daily is perfectible. The gate is invariant across endgame rules (pinned
  by tests); compute it through the solver, never reimplement it.
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

## Working conventions

- pnpm. TypeScript strict. Vite and Vitest. TDD: failing test first.
- Conventional Commits. No em dashes anywhere: commits, comments, docs.
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

## What is deliberately not here yet

UI, daily calendar, streaks, local storage, etymology gate, lemma rule,
hand review of the source pool, definitions bake. Later prompts. Counts in
this repo are optimistic ceilings on a raw pool until curation lands.
