---
updated: 202610301411
version: 1.1
---

# Scaffolder: `jyz create`

## Purpose

Speed up starting the projects actually built here. jyz is not a universal scaffolder and never aims to be; it owns a small, opinionated set of templates and refuses to grow into a generator for everything.

Hard rule: no external scaffolding tool. No `create-next-app`, no `cargo init`, no `bun create`. jyz writes the files itself.

## Command surface

`jyz create <name>` starts a project. Every prompt has an identical flag, so CI and agents never need a TTY.

| Flag | Meaning |
| --- | --- |
| `--template <t>` | `next`, `vite-tauri`, `cli`, `rust-bin`, `rust-lib`, `c`, `monorepo` |
| `--pm <pm>` | `bun`, `pnpm` |
| `--typechecker <c>` | `bun-check`, `tsc`, `tsgo`, `tsrs` |
| `--linter <l>` | `biome`, `bun-lint`, `none` |
| `--formatter <f>` | `biome`, `bun-fmt`, `prettier`, `none` |
| `--docs[=bool]` | include the `docs/` scaffold |
| `--git <mode>` | `skip`, `init`, `commit`, `github` |
| `--install[=bool]` | run the package manager after writing |
| `--publishable[=bool]` | JS templates get the manifest fields a release needs |
| `--dir <path>` | target directory, defaults to `./<name>` |
| `--yes` | accept defaults for anything unflagged |

Non-TTY without `--yes` or the required flags: exit non-zero with the missing flag named. Never hang on a prompt.

## Templates

| Family | Template | Package managers | Contents |
| --- | --- | --- | --- |
| JS/TS | `next` | bun, pnpm | Next App Router, React 19, Tailwind v4, TypeScript, `@/*` path alias without `baseUrl` |
| JS/TS | `vite-tauri` | bun, pnpm | Tauri 2 shell plus React 19 and Vite, frontend under `src/`, `src-tauri/` |
| JS/TS | `cli` | bun, pnpm | one bin entry, `src/` with `types/`, `const/`, `funcs/`, minimal argv parsing |
| Rust | `rust-bin` | cargo only | `cargo new` layout plus a customisable `[[bin]]` block |
| Rust | `rust-lib` | cargo only | `cargo new --lib` layout, `src/lib.rs` |
| C/C++ | `c` | none | `.c` and `.h` for C, `.cpp` and `.hpp` for C++, sources and headers together in `src/`, output in `dist/`, both a `Makefile` and a `justfile` |
| Meta | `monorepo` | per member | assembles `website/`, `cli/`, `desktop/` and so on from the templates above |

Every template must scaffold correctly on macOS, Linux and Windows, including path separators and line endings in generated files.

## Formatter and linter files

The two choices stay coherent, so a project never carries two tools doing one job:

- `--formatter biome` writes `biome.json` with `indentStyle: tab`, `indentWidth: 4`, `lineWidth: 100`.
- `--formatter bun-fmt` writes a `[fmt]` block in `bunfig.toml` with the same three values, and no `biome.json`.
- `--formatter prettier` writes `.prettierrc` (`useTabs: true`, `tabWidth: 4`, `printWidth: 100`) plus `.prettierignore`, and no `biome.json`.
- `--formatter none` writes neither.
- `--linter biome` reuses the same `biome.json`; choosing `biome` as both formatter and linter still yields one file, but with `--formatter prettier` the shared `biome.json` disables Biome's own formatter so the two never fight over the same lines.
- `--linter bun-lint` depends on `--formatter bun-fmt`, because both live in the Bun toolchain; an incompatible pair fails before any file is written.

`bun fmt` and `prettier` are first-class formatters, not fallbacks: each has a write mode and a read-only check mode (`bun fmt --check`, `prettier --check <paths>`), and the chosen one is what `jyz fmt` resolves to.

## C/C++ detail

- Standard extensions only: `.c/.h` and `.cpp/.hpp`. No `.c++`, no `.hxx`.
- Headers sit beside their sources in `src/`; no separate `include/` in v1.
- Both `Makefile` and `justfile` ship, holding the same build, check and clean commands, so either workflow works without editing.
- `dist/` is gitignored and created by the build, never committed.

## Shared structure

Every generated project gets, where applicable:

- `src/` with a `lib/`-style split (`types/`, `const/`, `funcs/`) so agentic development has an obvious home for new code early.
- `docs/` when `--docs` is set, using the same `plan/agent/` and `progress/{log,notes,reports}/` structure this repo uses.
- a minimal `AGENTS.md` containing the project's real commands (install, check, fmt, test, build) and nothing else.
- a `README.md` only when the template's audience needs one; not by default.

Minimalism rules:

- no setting that only restates a toolchain default
- no file the toolchain does not require
- no placeholder licence, changelog or CI workflow unless the template genuinely needs it
- the generated tree must be explainable file by file, in one pass

## Monorepo

`jyz create <name> --template monorepo` writes a root with the selected members, each scaffolded by the same template code used for a standalone project. The root carries `jyz.config.toml`, a root `package.json` if any member is JS, and the `docs/` scaffold. Members keep their own config only when they differ from the root.

## Publishing

`jyz publish` is a v1 non-goal: releasing belongs to CI and tags. The scaffolder still has to leave a project *able* to publish, so `--publishable` writes the manifest fields a release needs and nothing more:

- `bin` for CLI templates, pointing at the built entry
- `files` listing only what ships
- `publishConfig.access` set explicitly, never left to a default
- `engines` and a pinned `packageManager`, so CI resolves the same toolchain

Preparing a manifest is not publishing: jyz never calls `npm publish` and never holds a registry token.

## Git options

All four modes ship in v1.

- `--git skip` leaves the tree alone.
- `--git init` runs `git init`.
- `--git commit` also stages everything and makes the initial commit.
- `--git github` additionally creates the remote repository through the `gh` CLI, then sets `origin`. It is the only mode allowed to touch the network.

`github` rules:

- an unauthenticated or missing `gh` is a hard error before any file is written, naming the exact remedy
- the created repository URL is printed; nothing is assumed
- a failure after the local tree is written must still leave a valid local project and say exactly which step failed
- never fall back to a different mode silently

## Acceptance gate

- golden snapshot per template × package manager, byte-comparable apart from declared placeholders
- every generated project passes `jyz check` and its own build in CI on all three platforms
- a non-TTY run missing a required value fails with a message naming the flag
- `--publishable` asserted on the manifest fields: `bin`, `files`, `publishConfig.access`, `engines`
- `--git github` tested against a stubbed `gh` on `PATH`, covering success, missing `gh` and non-zero exit
- `jyz create --help` documents every flag above

## Open questions

- Whether the C template should default to C11 or C17, and likewise the C++ standard; pick one at M3 and record it in the generated `Makefile` comment.
