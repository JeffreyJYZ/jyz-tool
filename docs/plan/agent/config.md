---
updated: 202610301411
version: 1.1
---

# Config System

## Purpose

One file per project that says how jyz should behave there: which package manager, which typechecker, which linter, which formatter, what aliases and script overrides exist. Nothing more.

Scope correction (2026-10-30): `jyz.config.toml` holds **jyz's own settings only**. It does not absorb `package.json`, `tsconfig.json`, `biome.json` or any other native config, and jyz never generates those files outside `jyz create`.

## File

`jyz.config.toml`, at a project root or at a monorepo root.

```toml
[project]
package_manager = "auto"   # auto | bun | pnpm
typechecker = "auto"       # auto | bun-check | tsc | tsgo | tsrs | cargo | clang
linter = "biome"           # biome | eslint | bun-lint | cargo-clippy | clang-tidy | none
formatter = "biome"        # biome | bun-fmt | prettier | clang-format | rustfmt | none

[aliases]
a = "add"
i = "install"
r = "run"

[scripts]
lint = "biome check ."
typecheck = "bun check"

[create]
default_template = "cli"
default_package_manager = "bun"
git = "init"

[monorepo]
default_filter = false
```

Every key is optional. A file with no keys is valid and means "detect everything".

## Script overrides

`[scripts]` may define or replace a script that `jyz run <name>` executes, and the bare fallback (`jyz <name>`) uses it too.

- `[scripts]` beats a same-named `package.json` script.
- A core verb name always wins: `[scripts] lint` never changes what `jyz lint` does; it only changes `jyz run lint`.
- The motivation is a project whose real check or test command is not the toolchain default.

## Resolution

Precedence, highest first:

1. CLI flag
2. environment variable (`JYZ_PACKAGE_MANAGER`, `JYZ_TYPECHECKER`, …)
3. nearest `jyz.config.toml` walking up from cwd
4. detection from the project itself
5. built-in defaults

Discovery walks up from cwd to the filesystem root or a directory containing `.git`. In a monorepo, the root config applies first and a member's own config may override `[project]`; `[aliases]` and `[scripts]` from the root stay visible in members unless a member overrides them.

## Detection

| Signal | Result |
| --- | --- |
| `bun.lock` or `bun.lockb` | bun |
| `pnpm-lock.yaml` | pnpm |
| `package.json` `packageManager` field | whichever it names, only when no lockfile exists |
| both lockfiles | error naming both; never guess |
| no signal in a JS project | configured default, else `bun` |

Typechecker and linter detection follow the same shape: `bunfig.toml` plus a Bun workspace means `bun-check` is available, `tsconfig.json` means `tsc`, `biome.json` means `biome`, `Cargo.toml` means `cargo`, and `tsgo`/`tsrs` are only selected when the binary resolves in `node_modules/.bin` or `PATH`.

Formatter detection is the same idea: `biome.json` means `biome`, a `[fmt]` block in `bunfig.toml` means `bun-fmt`, and any Prettier config (`.prettierrc`, `prettier.config.*` or a `prettier` key in `package.json`) means `prettier`. Two formatter signals at once is an error naming both, matching the lockfile rule.

Linter detection mirrors it: `biome.json` with linter rules means `biome`, `eslint.config.*` or `.eslintrc*` or an `eslintConfig` key means `eslint`, and a `[lint]` block in `bunfig.toml` means `bun-lint`. Two linter signals is the same error.

Language-native tools use their own files: `.clang-format` means `clang-format`, `.clang-tidy` means `clang-tidy`, `rustfmt.toml` or a `Cargo.toml` means `rustfmt`, and a `Cargo.toml` also means `cargo-clippy`. A C/C++ project with neither file gets `clang-format` and `clang-tidy` as the scaffolded defaults, not as implicit detection.

## Commands

| Command | Behaviour |
| --- | --- |
| `jyz config show` | print the merged config with each value's source layer |
| `jyz config get <key>` | print one resolved value |
| `jyz config set <key> <value>` | write the nearest file |
| `jyz config path` | print the file jyz would read |
| `jyz config check` | validate; `--strict` fails on unknown keys |

`config set` preserves comments and formatting. When a file cannot be round-tripped without losing something, the command refuses, names the line it cannot handle and writes nothing. A silent rewrite that drops comments is a defect.

Validation is lenient by default: an unknown key warns on every run and names the key, so a typo cannot hide. `jyz config check --strict` turns the same warning into an error, which is what CI uses.

## Acceptance gate

- fixture trees for bun-only, pnpm-only, monorepo root plus member, conflicting lockfiles, and a project with no config at all
- a precedence test per layer, so a moved layer changes the answer
- `jyz config check --strict` exits non-zero on an unknown key and names the key
- `jyz config show` reports the originating layer for every value
- `config set` preserves a commented file byte-exactly, and refuses on a shape it cannot round-trip
- `[scripts]` override test: `jyz run lint` uses the override, `jyz lint` does not

## Resolved

- Script overrides: allowed through `[scripts]`, with core verbs winning.
- Validation: warn by default, error under `--strict`.
- `config set`: preserve comments, refuse otherwise.
