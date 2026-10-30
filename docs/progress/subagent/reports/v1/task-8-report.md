# Task 8 — CLI implementations

Status: complete. All commands registered in `packages/cli/src/{bin.ts,commands/*.ts}` now have real actions; `packages/cli/src/commands/config.ts` typechecks again.

## Files

Owned files changed:

- `packages/cli/src/bin.ts` — boot path: reads only the `[aliases]`/`[scripts]` tables before parse (no detection, so `--version` and `config path` cannot be blocked by a detection conflict), validates and expands aliases, runs the bare-script fallback, registers commands, adds the `Aliases` help section, runs cac with `run: false` and awaits the matched action.
- `packages/cli/src/commands/config.ts` — `config show | get <key> | set <key> <value> | path | check [--strict]` over the core config functions; `set` writes the text `writeConfigValue` returns, so comments survive, and a refused rewrite writes nothing.
- `packages/cli/src/commands/dispatch.ts` — `install`, `add` (`-D/--dev`), `remove`/`rm`, `run`, `exec`/`x`, `update` (`--latest`), `outdated`, each with `-F/--filter <name>`, help, `--verbose` and exit-code passthrough.
- `packages/cli/src/commands/create.ts` — `create <name>` with `--template --pm --typechecker --linter --formatter --docs --git --install --publishable --dir --yes`, printing every written path; `--install` runs `<pm> install` in the new directory.
- `packages/cli/src/lib/args.ts` — reads argv directly so flags jyz does not own (`--exact`, `--frozen-lockfile`) reach the package manager verbatim, while `-D/--dev`, `--latest`, `-F/--filter` and `--verbose` are consumed.
- `packages/cli/src/lib/verbs.ts` — core verb list, alias validation, expansion (chained aliases included), `AliasError`, alias help body.
- `packages/cli/src/lib/dispatch.ts` — `CommandSpec` per verb via core `buildArgv`, `exec` preferring `node_modules/.bin` over the runner, and `formatSpec` for `--verbose`.
- `packages/cli/src/lib/scripts.ts` — merged config/`package.json` script table, shell-free command splitting, `buildScriptSpec`, listing format.
- `packages/cli/src/lib/config-view.ts` — `config show` lines with each value's source layer, `config get` key lookup.
- `packages/cli/src/lib/context.ts` — detection-free config tables, tolerant `loadConfigAt`, `configPathIn`, package lookup.
- `packages/cli/src/lib/errors.ts` — one error printer for core and CLI error classes, plus the async `guard` helper.
- `packages/cli/src/lib/run.ts` — spawns a spec with inherited stdio, returns the child's code, reports a missing binary by name and by the detection that chose it.
- `packages/cli/src/lib/prompt.ts` — the single `create` confirmation, skipped when stdin is not a terminal.

Tests, all new:

- `packages/cli/test/{args,alias,dispatch,verbose,config-view,scripts}.test.ts`, plus `packages/cli/test/fixtures.ts` (context/config builders) and the removal of the placeholder `smoke.test.ts`.

## Verification

`bun test packages/cli/test` — 38 pass, 0 fail over 6 files; `bun check` — no type errors in 51 files; `bunx biome check packages/cli/src packages/cli/test` — 0 errors, 1 warning that predates this task (`any` in `toolchain.ts`); `bun fmt --check` clean for `packages/cli`; `jyz config path` prints `/Users/jyz/dev/jyz/jyz.config.toml` from the repo root.

Live checks beyond the tests: alias to a verb and to a verb plus arguments, shadowed-alias refusal (exit 1, names the alias), `config check --strict` (exit 1 on an unknown key) versus lenient (exit 0), `config set` keeping a leading comment and a trailing comment, appended section creation, `create demo --template cli --yes --dir demo` writing a project, `run` with no script listing the merged table, bare fallback to a `package.json` script and to a `[scripts]` override, `exec` choosing `node_modules/.bin` and `--verbose` printing file/argv/cwd.

## Concerns

- cac v7 has no nested commands (`c.Command` has no `.command`), so `config` is one command with `[action] [key] [value]` positionals and each subcommand shape is an example line in its help rather than a separate help entry.
- Core's `detectFormatter` reports this repo's own `biome.json` plus `bunfig.toml [fmt]` as conflicting signals, and `resolveProject` calls all four detectors eagerly. Every dispatch and toolchain command therefore fails in this repository with `conflicting formatter signals`. The `config` commands tolerate a conflicting linter/formatter (warning, value falls through) and keep working, but the dispatch verbs cannot: the throw happens inside core's `resolveProject`, which a conflicting lockfile also has to keep failing on. This needs a core decision, not a CLI patch.
- `--verbose` covers the dispatch verbs, the bare-script fallback and `create --install`. `packages/cli/src/commands/toolchain.ts` (owned by another task) prints no spec, so `lint`/`typecheck`/`check`/`fmt` ignore the flag.
- `jyz run` with no script prints the merged listing itself instead of delegating to `<pm> run`, because delegating would hide a `[scripts]` override and could not show one at all.
- `--yes` skips the confirmation prompt only; a non-interactive run (pipe, CI) proceeds without asking rather than hanging.
- `packages/cli/test/smoke.test.ts` was replaced by the suites above; nothing else in `packages/cli` was touched.
