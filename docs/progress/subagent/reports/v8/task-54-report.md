# Task 54 report

Added interactive feature selection to `jyz create`.

- `packages/cli/src/lib/prompt.ts`: `selectFeatures()` helper.
- `packages/cli/src/commands/create.ts`: prompts only when no feature flags, TTY, no `--yes`, no `--json`.

Gates: `bun test packages/cli/test` 78 pass; `bun check` passes for touched files; `bun run size` passes; `bun run lint` passes for touched files.
