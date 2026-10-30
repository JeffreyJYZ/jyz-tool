## Task 4 — CLI surface

Wave A. Model tier: easy.

Owns: `packages/cli/src/bin.ts`, `packages/cli/src/commands/config.ts`, `packages/cli/src/commands/dispatch.ts`, `packages/cli/src/commands/create.ts`, `packages/cli/src/lib/**`, `packages/cli/test/**`, `scripts/bump-alpha.ts`. It imports `registerToolchain(cli)` from `packages/cli/src/commands/toolchain.ts`, which Task 6 owns: never create or edit that file.

Builds the whole surface with `cac`, one module per verb group under `packages/cli/src/commands/`, help text per verb, and `--verbose` printing the resolved command. Commands: `config show|get|set|path|check`, `install`, `add`, `remove`, `run`, `exec`, `update`, `outdated`, `create`, `lint`, `typecheck`, `check`, `fmt`, plus user aliases and the bare-script fallback from [dispatch.md](dispatch.md). Unknown verb that matches a script runs it; otherwise print help and exit 1. Aliases that shadow a core verb fail validation naming the alias.

`scripts/bump-alpha.ts` increments the alpha suffix of every manifest (`package.json`, `packages/{core,cli,desktop}/package.json`, `packages/desktop/src-tauri/tauri.conf.json`, `packages/desktop/src-tauri/Cargo.toml`), prints the new version, and with `--tag` creates `v<version>`. It never pushes.

Tests: each command builds the expected `CommandSpec` against a temp fixture project (call the pure builder, not the CLI binary); alias expansion; shadowed-alias refusal; unknown verb behaviour; bump script updates all six files and increments `alpha.N` to `alpha.N+1`.
