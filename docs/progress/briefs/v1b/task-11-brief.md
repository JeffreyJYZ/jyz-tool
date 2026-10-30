## Task 11 — check aggregate and verbose toolchain output

Owns: `packages/core/src/funcs/toolchain.ts`, `packages/core/test/toolchain-aggregate.test.ts`, `packages/cli/src/commands/toolchain.ts`.

- `buildCheckCommand` returns one spec per applicable half, skipping a half whose tool is `none`
- `jyz check` runs every spec, prints each half under its own heading, exits non-zero if any half failed, and runs both even when the first fails
- when neither half applies it throws `ToolchainError` naming what was looked for
- `--verbose` on `lint`, `typecheck`, `check`, `fmt` prints each resolved command's argv and cwd before running, matching what dispatch verbs already print

Tests: both-halves fixture with a failing linter and a passing typechecker (assert both ran, exit non-zero, both headings appear), a `none` linter fixture (only typecheck runs), a nothing-configured fixture (throws), and a verbose-output shape assertion.
