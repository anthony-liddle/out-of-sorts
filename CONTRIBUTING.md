# Contributing

## Development setup

```sh
pnpm install
pnpm bake
pnpm test
```

## Commit conventions

Conventional Commits, enforced by commitlint:
`<type>(<scope>): <subject>` with types feat, fix, docs, style, refactor,
test, chore, build, ci, perf, revert. No em dashes in commit messages.

## Code style

Prettier and ESLint run via lint-staged on commit, typecheck runs
pre-commit. TypeScript is strict. Write the failing test first.

## Pull requests

Branch from `main` as `type/kebab-case-description`. Keep the verification
sweep green: `pnpm verify:sweep` must report zero mismatches. Review the
working rules in CLAUDE.md before touching the data bake, the solver, or
the endgame rule flag.
