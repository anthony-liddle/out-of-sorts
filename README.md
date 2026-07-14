# Out of Sorts

A daily word game about attrition.

[Play it](https://out-of-sorts.vercel.app)

![License](https://img.shields.io/badge/license-MIT-green) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Vite](https://img.shields.io/badge/Vite-7-purple)

You start with eight scrambled letters. Make a word from them. The pool
becomes exactly the letters you used, and **every letter you did not use is
gone for good**. No word twice. The run ends when nothing more can be made.

Your score is the Scrabble value of every word you play, which is the same
as each letter's value times the number of words it survived in. So the game
is really one question, asked over and over: **which letter are you willing
to lose?**

Every daily is perfectible. A rack only becomes a day if a clean ladder
through it exists in common words, so a perfect run is always there. Finding
it is on you.

## What is here

The whole game: engine, solver, calendar, and UI.

- `src/engine/` the engine: puzzle creation, immutable run state, play
  legality, end detection, the endgame rule flag, the eligibility gate.
- `src/engine/solver.ts` an exhaustive, exact solver: par, best clean
  descent, max depth, path reconstruction, hold inventory, greedy baseline.
  It solves a rack in about half a millisecond.
- `src/calendar/` the append-only daily calendar, two decoupled epochs, the
  pure day function, and Endless.
- `src/loader/` cold start: the dictionary index builds in a worker and is
  cached in IndexedDB, so the rack renders long before any of it lands.
- `src/ui/` the game in the Ghosts theme: the vertical board, three tile
  states, the drift, the stack, the end screen.
- `scripts/` the offline data bake, the calendar generator, and the
  cross-language verification sweep.
- `data/raw/` vendored ENABLE and classic SCOWL v1 (2020.12.07) word lists.
- `scratch/` four discovery passes and their reports. Every design number in
  the game was measured there first.

## Getting started

```sh
pnpm install
pnpm dev           # play it locally
pnpm test          # the full suite, including the verification sweep
pnpm verify:sweep  # cross-language acceptance sweep, prints the numbers
```

Other commands:

```sh
pnpm bake               # regenerate public/data from data/raw (offline)
pnpm generate:calendar  # deliberate and manual: the calendar is append-only
pnpm bench              # cold start and puzzle creation timings
pnpm run check:flavour  # prove the F-Droid bundle carries no analytics
```

## Design guarantees

These are the rules the game rests on. They were measured, not argued; the
receipts are in `scratch/REPORT*.md`.

- **Par is common-pool only**, never the validation boundary. The true
  optimum over the full boundary exceeds par on 100 percent of racks,
  roughly doubling it, so par against the boundary would be unreachable by
  anyone. The boundary's job is generous acceptance during play. It is never
  the yardstick.
- **The gate is not configurable.** A rack becomes a day only if a Clean
  Descent exists for it in common words. Every daily is perfectible.
- **The calendar is append-only.** Day N is the entry at position N, forever.
  Reordering or removing an entry re-dates every day after it.
- **The endgame rule is a flag** (`mill`, `terminal-three`, `descent`) with a
  single predicate behind it, so a playtest week can flip it without
  regenerating anything. Default: `mill`.
- **The engine reproduces the Python discovery numbers exactly**, across all
  three rules, with zero mismatches. `pnpm verify:sweep` pins it in CI.

## Privacy and the build flavours

No analytics, no telemetry, no trackers in the app bundle. The website runs
Vercel Analytics for traffic counts; the F-Droid flavour cannot contain the
package at all, so it is compiled out at build time rather than disabled at
runtime, and `pnpm run check:flavour` proves it.

The game is offline after first load. Progress lives in local storage. There
is no backend.

## Tech stack

TypeScript (strict), React, Vite, Vitest, Playwright, pnpm. The engine is
pure and browser-free; it runs anywhere Node or a bundler does.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Conventional Commits, TDD, and the
working rules in [CLAUDE.md](CLAUDE.md) apply.

## License

[MIT](LICENSE)
