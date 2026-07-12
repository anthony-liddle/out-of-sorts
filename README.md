# Out of Sorts

A daily word game about attrition.

![License](https://img.shields.io/badge/license-MIT-green) ![TypeScript](https://img.shields.io/badge/TypeScript-strict-blue) ![Vite](https://img.shields.io/badge/Vite-7-purple)

A run starts with the eight scrambled letters of a source word. Make a word
from the pool; the pool becomes exactly the letters you used; everything
else is gone for good. No repeats. The run ends when nothing more can be
made. Score is the Scrabble value of every word you play, which is the same
as each letter's value times the number of words it survived in.

Every daily is perfectible: a source word only headlines if a perfect clean
ladder exists for its rack. Finding it is on you.

## What is here

The pure TypeScript engine, an exhaustive solver, and an offline data bake.
No UI yet; that is the next build.

- `src/engine/` engine: puzzle creation, immutable run state, play
  legality, end detection, the endgame rule flag, the eligibility gate.
- `src/engine/solver.ts` exact solver: par, best clean descent, max depth,
  path reconstruction, hold inventory, greedy baseline.
- `scripts/bake.ts` reproducible offline bake from the vendored raw lists.
- `scripts/verify-sweep.ts` cross-language acceptance sweep against the
  Python discovery results in `scratch/`.
- `data/raw/` vendored ENABLE and classic SCOWL v1 (2020.12.07) lists.

## Getting started

```sh
pnpm install
pnpm bake          # regenerate public/data from data/raw (offline)
pnpm test          # full suite, including the verification sweep
pnpm verify:sweep  # cross-language acceptance sweep, prints the numbers
pnpm bench         # performance budget measurements
```

## Design guarantees

- Par is measured against the common pool (SCOWL 50) only. The validation
  boundary (ENABLE union SCOWL 95) accepts generously during play and is
  never the yardstick.
- The endgame rule (`mill`, `terminal-three`, `descent`) is a config flag
  with a single predicate behind it. Default: `mill`.
- The eligibility gate is not configurable and is invariant across endgame
  rules.
- The engine reproduces the Python discovery numbers exactly; see
  `scratch/REPORT*.md` for how they were measured.

## Tech stack

TypeScript (strict), Vite, Vitest, pnpm. The engine is pure and
browser-free; it runs anywhere Node or a bundler does.

## Contributing

See [CONTRIBUTING.md](CONTRIBUTING.md). Conventional Commits, TDD, and the
working rules in [CLAUDE.md](CLAUDE.md) apply.

## License

[MIT](LICENSE)
