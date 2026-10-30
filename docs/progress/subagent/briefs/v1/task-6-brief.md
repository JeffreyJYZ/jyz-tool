## Task 6 — core toolchain verbs and CLI wiring

Wave A. Model tier: easy.

Owns: `packages/core/src/funcs/toolchain.ts`, `packages/core/test/toolchain.test.ts`, `packages/cli/src/commands/toolchain.ts`.

`packages/cli/src/commands/toolchain.ts` exports `registerToolchain(cli: CAC): void`, registering `lint`, `typecheck`, `check` and `fmt` against the core builders. Nothing else in the CLI tree belongs to this task.

`funcs/toolchain.ts` exports `buildLintCommand(ctx: ProjectContext, args?: string[]): CommandSpec`, `buildTypecheckCommand(...)`, `buildCheckCommand(...)` (returns an array of `CommandSpec` for the applicable halves), and `buildFmtCommand(ctx, { check }: { check?: boolean })`, following [toolchain.md](toolchain.md). A configured tool whose binary does not resolve throws `ToolchainError` naming the tool and config key; a project with nothing configured exits with a `ToolchainError` naming what was looked for.

Tests: one per checker and linter; `none` skipping a half; `check` returning both halves and skipping `none`; `fmt --check` read-only form; missing-binary error message contains the config key.
