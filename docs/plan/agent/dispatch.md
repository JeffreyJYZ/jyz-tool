---
updated: 202610301411
version: 1.1
---

# Command Dispatch

## Purpose

Make `jyz` behave like whatever package manager the project already uses, without ever reimplementing dependency resolution. jyz detects the package manager, resolves the target package in a monorepo, and shells out to the real binary with the right argv in the right directory.

## Verbs

| Verb | bun | pnpm | Notes |
| --- | --- | --- | --- |
| `jyz install` | `bun install` | `pnpm install` | no arguments means install from lockfile |
| `jyz add <pkgs>` | `bun add` | `pnpm add` | `-D/--dev` for dev dependencies |
| `jyz remove <pkgs>` | `bun remove` | `pnpm remove` | alias `rm` |
| `jyz run <script>` | `bun run` | `pnpm run` | extra args forwarded |
| `jyz exec <bin>` | `bunx` | `pnpm exec` | alias `x` |
| `jyz update [pkgs]` | `bun update` | `pnpm update` | `--latest` forwarded |
| `jyz outdated` | `bun outdated` | `pnpm outdated` | read-only |

Explicitly out of v1: `publish`. Releasing belongs to CI and tags, not to the everyday command surface.

Dev dependencies are first class: `jyz add -D typescript` and `jyz add --dev typescript` both map to the manager's dev flag.

`jyz run` with no script name prints the resolved package's scripts only, one per line with the command beside it. In a monorepo, `-F` changes which package that is; it never dumps every member's scripts.

## Aliases and script overrides

User-defined in `jyz.config.toml`:

```toml
[aliases]
a = "add"
i = "install"
r = "run"
dev = "run dev"

[scripts]
e2e = "bun test --timeout 60000"
```

Rules:

- an alias may expand to a verb plus arguments
- an alias may never shadow a core verb name; such a config fails validation at load with the offending name
- `[scripts]` beats a same-named `package.json` script for `jyz run <name>` and the bare fallback, but never changes a core verb
- aliases print in `jyz --help` under their own heading
- bare-script fallback: an unknown verb that matches a script (config or `package.json`) runs it, so `jyz dev` works without configuring anything

## Monorepo routing

Resolve the acting package from cwd upward: the nearest directory with a `package.json` (or a Rust/C member root) wins. `-F/--filter <name>` targets another package by name. Both the cwd and the chosen package are printed under `--verbose`.

Ambiguity is an error, never a guess: a verb that matches no package, or a filter naming zero or several packages, exits non-zero and lists the candidates.

## Execution contract

- Build argv arrays and spawn without a shell. No string concatenation, ever.
- Inherit stdio so interactive tools behave normally.
- Forward `SIGINT`/`SIGTERM` to the child and mirror its exit code.
- On Windows, resolve `.cmd` shims for `pnpm` explicitly; never rely on shell resolution.
- If the package manager binary is missing, exit non-zero naming the binary and the detection result that chose it.

`jyz exec <bin>` resolution order: walk up from the acting package looking for `node_modules/.bin/<bin>`, run the first hit; only then fall back to the package manager's runner (`bunx` / `pnpm exec`). The chosen path is printed under `--verbose`, so a surprising binary is visible rather than mysterious.

## Acceptance gate

- table-driven tests asserting the exact child argv per verb per package manager on all three platforms
- stub binaries on `PATH` record their argv, cwd and environment; the test compares the recording, not the human output
- monorepo tests: cwd inference, `-F`, ambiguous filter, no matching package
- `exec` tests: `.bin` hit preferred over the runner, runner used when `.bin` is empty
- exit-code passthrough test including a non-zero child and an interrupted child
- Windows CI green on the same table

## Resolved

- `jyz run` with no arguments: resolved package only.
- `exec`: `node_modules/.bin` first, package manager runner second.
- Script overrides: allowed through `[scripts]`, core verbs win.
