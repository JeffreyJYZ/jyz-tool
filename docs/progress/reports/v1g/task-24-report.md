# Task 24 — `--json` output mode

Status: done.

Files: `packages/cli/src/lib/output.ts`, `packages/cli/src/lib/run.ts`, `packages/cli/src/lib/errors.ts`, `packages/cli/src/bin.ts`, `packages/cli/src/commands/config.ts`, `packages/cli/src/commands/dispatch.ts`, `packages/cli/src/commands/create.ts`, `packages/cli/src/commands/toolchain.ts`, `packages/cli/test/json.test.ts`.

Tests: 64 pass across packages/cli/test (json.test.ts: 2 pass).

Concerns: dispatch verbs capture stdout/stderr by spawning directly (bypassing core runCommand); toolchain check emits one combined JSON after running all halves. Pre-existing lint errors outside owned files remain.
