---
updated: 202610301411
version: 2.0
---

# Toolchain Verbs: `lint`, `typecheck`, `check`, `fmt`

## Purpose

Give the everyday loop stable verbs that work the same in every project, while the actual tool stays whatever the project already chose.

Four verbs, one job each:

- `typecheck` runs type checking
- `lint` runs the linter
- `check` runs both, in one pass, when applicable
- `fmt` formats; `fmt --check` only verifies

`jyz check` is the aggregate, not a third tool. `test` and `build` stay in the project's own scripts and run through `jyz run`.

## `jyz typecheck`

| Typechecker | Command |
| --- | --- |
| `bun-check` | `bun check` |
| `tsc` | `tsc --noEmit` |
| `tsgo` | `tsgo --noEmit` |
| `tsrs` | project-local tsrs binary, `--noEmit` |
| `cargo` | `cargo check` |
| `make` / `just` | `make typecheck` / `just typecheck` only when the target exists |

## `jyz lint`

| Linter | Command |
| --- | --- |
| `biome` | `biome check <paths>` (read-only; formatting rules included) |
| `eslint` | `eslint <paths>` |
| `bun-lint` | `bun lint` |
| `cargo-clippy` | `cargo clippy -- -D warnings` |
| `none` | no-op that prints the configured reason and exits 0 |

## `jyz check`

The aggregate, with these rules:

- runs the configured typechecker when one is applicable, then the configured linter when one is applicable
- runs both even when the first fails, so one invocation reports everything; it exits non-zero if either failed
- a half configured as `none` is skipped, not treated as a failure
- when neither half applies, exits non-zero with "nothing to check" rather than a false green
- extra arguments are forwarded to the typechecker only, since a linter and a typechecker rarely accept the same flags; `--lint-args` and `--typecheck-args` exist for the rest
- output groups each half under its own heading, so a failure is attributable at a glance

## `jyz fmt`

| Formatter | Command |
| --- | --- |
| `biome` | `biome check --write` on tracked paths |
| `bun-fmt` | `bun fmt` |
| `prettier` | `prettier --write <paths>` |
| `none` | no-op that prints the configured reason and exits 0 |

`jyz fmt --check` must run the read-only form (`biome check`, `bun fmt --check`, `prettier --check <paths>`), because a writing formatter can never be a gate.

Formatter files, never two at once:

- `biome` → `biome.json`, with its formatter rules at tabs 4 / width 100
- `bun-fmt` → `[fmt]` in `bunfig.toml`
- `prettier` → `.prettierrc` plus `.prettierignore`, with `useTabs: true`, `tabWidth: 4`, `printWidth: 100`

A `prettier` formatter beside a `biome` linter means the shared `biome.json` disables Biome's formatter, so the two tools never rewrite the same lines. The mirror case holds too: an `eslint` linter beside a `biome` formatter means that `biome.json` disables Biome's linter, so exactly one tool owns each job.

## Resolution rules

- the resolver picks from `jyz.config.toml` first, then detection
- a configured tool whose binary does not resolve is a hard error naming both the tool and the config key; never a silent fallback to another tool
- `tsgo` and `tsrs` are looked for in `node_modules/.bin` walking upward, then `PATH`
- a project with no detectable tool exits non-zero naming what was looked for, rather than succeeding silently

Known trap, recorded so it does not get rediscovered: a `package.json` script named `fmt`, `check` or `lint` shadows the Bun built-in of the same name, so `bun fmt --check` can end up writing and `bun check` can stop type-checking. The resolver must prefer the built-in form and refuse to route through a shadowing script.

## Acceptance gate

- resolver test per typechecker, per linter and per formatter, including a configured-but-missing binary and a project with nothing configured
- `jyz check` aggregate test: both halves run, both failures reported, exit code non-zero, each under its own heading
- `jyz check` with one half `none` runs only the other and still exits by that half's result
- `jyz fmt --check` proven read-only: a deliberately unformatted fixture stays untouched and the command exits non-zero
- shadowing-script fixture asserts the resolver does not route `fmt` through a `package.json` script named `fmt`
- all three platforms green

## Resolved

- `check` runs both lint and typecheck when applicable, with `lint` and `typecheck` also available alone.
- Canary binaries resolve from `node_modules/.bin` then `PATH`.
- Linting stays a separate verb from type checking.
