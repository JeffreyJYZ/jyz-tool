# Task 11 — check aggregate and verbose toolchain output

Status: done.

Files:

- `packages/core/src/funcs/toolchain.ts`
- `packages/core/test/toolchain-aggregate.test.ts`
- `packages/cli/src/commands/toolchain.ts`

Tests: 51 pass, 0 fail (toolchain + CLI suites); core toolchain-aggregate suite 4/4 pass. `bun check` reports no errors in owned files (only pre-existing `scripts/release-notes.ts`).

Concerns: CLI half-labels derived from resolved config predicates (typechecker/linter !== "none") rather than a core export, because `buildCheckCommand` returns `CommandSpec[]` per contract and only `.` is exported from core. Order contract documented in core. Pre-existing `create-git` test failures (pnpm/network) unrelated.
