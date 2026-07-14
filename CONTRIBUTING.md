# Contributing

## Read the GDD first

The design source of truth is the GDD, which lives in the author's vault at
`../vault/Projects/Out of Sorts/GDD.md`, not in this repo. Read it before
any design-affecting work. The repo's [CLAUDE.md](CLAUDE.md) carries the
working rules that keep the code honest to it.

## Development setup

```sh
pnpm install
pnpm dev    # play it locally
pnpm test   # the full suite
```

The word lists and the calendar are committed, so nothing needs generating
to run the game.

## Testing

Write the failing test first. Three layers, and they are not
interchangeable:

- **Unit and component tests** (Vitest, jsdom) for logic and behavior.
- **Browser tests** (`test/layout.test.ts`, Playwright) for anything about
  size, position, wrapping, overflow, or computed style. **jsdom has no
  layout engine**, and a build that was fully green in jsdom still wrapped
  the rack 6 and 2 on a phone.
- **The verification sweep** (`pnpm verify:sweep`), which reproduces the
  Python discovery numbers exactly, across all three endgame rules, with
  zero mismatches. It must stay at zero. If a number moves, that is a bug in
  the engine, not a rounding difference.

Two rules learned the hard way, both in CLAUDE.md:

- Anything derived from a committed artifact must be tested **against the
  committed artifact**. Synthetic-date tests cannot see a bad calendar epoch,
  and one sat in the future for the life of the project while 150 tests said
  nothing.
- Never substitute a plausible default for a null the engine returned
  deliberately. A null is a fact.

## Commit conventions

Conventional Commits, enforced by commitlint:
`<type>(<scope>): <subject>` with types feat, fix, docs, style, refactor,
test, chore, build, ci, perf, revert. **No em dashes anywhere**, including
commit messages, code comments, and docs.

## Code style

Prettier and ESLint run via lint-staged on commit; typecheck runs
pre-commit. TypeScript is strict.

The UI never reimplements engine logic. Score, legality, holds, par, rank,
end detection, and spent-letter age all come from the engine; components
read state and render it.

## Pull requests

Branch from `main` as `type/kebab-case-description`. Before opening one:

```sh
pnpm test
pnpm verify:sweep      # must report zero mismatches
pnpm typecheck && pnpm lint
pnpm run check:flavour # the F-Droid bundle must carry no analytics
```

For anything visual, **look at it**, and on a real phone if it touches the
board. Several bugs here passed every test and still looked wrong, which is
how the ghost hem, the wrapped rack, and the disabled-looking cold tile all
shipped.
