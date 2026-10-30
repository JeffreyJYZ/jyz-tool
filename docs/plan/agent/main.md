---
updated: 202610301411
version: 1.2
---

# JYZ: Personal Hub For Projects

## Overview

jyz is a dev tool that scaffolds projects, keeps one config file, and routes commands to the toolchain a project already uses. A single core implementation powers every surface, so the CLI, the desktop app and the MCP server cannot drift apart.

Core features:

- a project scaffolder that uses no external scaffolding tools
- a config system in a single `jyz.config.toml`, scoped to jyz's own settings only
- a CLI that behaves as any package manager by delegating to the one the project already uses
- a Tauri desktop interface that is lightweight and minimal (v2)
- feature parity between CLI and desktop, guaranteed by a shared core package
- an MCP server so agents can drive jyz (v2)
- opencode integration, driving sessions through its client SDK (v2)

## Decisions

Settled 2026-10-30. Each one is load-bearing for the milestone plan below.

| Area | Decision |
| --- | --- |
| Core language | TypeScript on Bun. One core, thin adapters. |
| Config scope | `jyz.config.toml` holds jyz's own settings only. Native configs (`package.json`, `tsconfig.json`, `biome.json`) are never absorbed or generated. |
| Config overrides | `[aliases]` and `[scripts]` are the override surface; a core verb name always wins over a `[scripts]` entry. |
| Package manager | Detect what the project uses, then delegate to the installed binary. jyz never resolves or installs dependencies itself. |
| Platforms | macOS, Linux and Windows. Windows CI from v1. |
| Scaffold coverage | All four families in v1: JS/TS, Rust, C/C++. |
| Scaffold input | Prompts on a TTY, an identical flag twin for every prompt. |
| C/C++ scaffold | Standard `.c/.h/.cpp/.hpp` in `src/`, with both a `Makefile` and a `justfile`. |
| create git modes | `skip`, `init`, `commit` and `github` all ship in v1. |
| Command surface | `install`, `add`, `remove`, `run`, `exec`, `update`, `outdated`, `create`, `config`, `lint`, `typecheck`, `check`, `fmt`. No `publish`. |
| Check semantics | `lint` and `typecheck` are separate verbs; `check` runs both when applicable and skips the half configured as `none`. |
| Formatter | `biome`, `bun fmt`, `prettier`, `clang-format` or `rustfmt`, picked per project; every one exposes a read-only check mode. |
| Linter | `biome`, `eslint`, `bun lint`, `cargo clippy`, `clang-tidy` or `none`, picked per project. |
| Monorepo routing | Infer the package from cwd upward, plus `-F/--filter <name>`. |
| Phasing | Milestones with explicit acceptance gates. |
| Code layout | Bun workspace: `packages/core`, `packages/cli`. |
| MCP shape | Streaming tools for long verbs; distributed both as an npm package with a bin entry and as standalone binaries. |
| Desktop packaging | The desktop installer ships the CLI as well; a CLI-only install stays CLI-only. The app is a wrapper over the CLI. |
| Plan layout | One file per feature under `docs/plan/agent/`, indexed here. |

## Architecture

The rule that makes parity real: **every capability lives in `packages/core`. Adapters only parse input, call core and render output.**

- `packages/core` owns config loading, project and package-manager detection, monorepo routing, scaffold rendering, command resolution and process execution.
- `packages/cli` is an adapter: argv parsing, prompts, human-readable output, exit codes.
- Core exposes a JSON-RPC surface (stdio) beside its plain TypeScript API. The CLI calls it in-process; the v2 desktop app runs the installed CLI as its sidecar; the v2 MCP server imports the API directly.
- A capability manifest is generated from core's registered operations. A test asserts the CLI reaches every entry, and the desktop parity gate reuses the same manifest, so parity is checked mechanically rather than promised.

Constraints that follow from "minimal":

- never write a setting that only restates a toolchain default
- never emit a file the target toolchain does not need
- every generated file must be justifiable in one sentence

## Repo layout

```
jyz/
  AGENTS.md
  README.md
  bunfig.toml
  biome.json
  package.json
  packages/
    core/
    cli/
    desktop/   (v2)
    mcp/       (v2)
  docs/
    plan/agent/
    progress/log/
    progress/notes/
    progress/reports/
```

The `docs/` tree exists already and is planned, not incidental:

- `docs/plan/agent/` holds this plan, one file per feature.
- `docs/progress/log/` holds dated work logs, one file per session.
- `docs/progress/notes/` holds decisions, gotchas and corrections worth keeping.
- `docs/progress/reports/` holds subagent and review reports verbatim, plus one report per milestone and one per released version.

## Feature index

| Feature                                               | File                         | Milestone |
| ----------------------------------------------------- | ---------------------------- | --------- |
| Scaffolder (`jyz create`)                             | [create.md](create.md)       | M3        |
| Config system                                         | [config.md](config.md)       | M1        |
| Command dispatch (`install` … `outdated`)             | [dispatch.md](dispatch.md)   | M2        |
| Toolchain verbs (`lint`, `typecheck`, `check`, `fmt`) | [toolchain.md](toolchain.md) | M4        |
| Tauri desktop                                         | [desktop.md](desktop.md)     | v2        |
| MCP server                                            | [mcp.md](mcp.md)             | v2        |
| opencode integration                                  | [opencode.md](opencode.md)   | v2        |

## Milestones

Each milestone ends at a gate. A gate is a command that fails loudly; prose acceptance does not count.

Status 2026-10-30: M0–M4 shipped, release line `0.1.0-alpha.4`. Gate results live in [../progress/reports/v1-milestone.md](../../progress/reports/v1-milestone.md); what landed after v1 is in [../progress/notes/2026-10-30-post-v1.md](../../progress/notes/2026-10-30-post-v1.md).

### M0 — Bootstrap

- Bun workspace with `packages/core` and `packages/cli`, root `bunfig.toml` with `[fmt]` (tabs, `tabWidth 4`, `printWidth 100`), `biome.json`, `.gitignore` including `.DS_Store`.
- Root `AGENTS.md` with the real commands, and a short `README.md`.
- GitHub Actions matrix on `macos-latest`, `ubuntu-latest`, `windows-latest`.

Gate: CI green on all three for `bun install`, `bun check`, `biome check .`, and `jyz --version` printing a version.

### M1 — Config and detection

- TOML load, validate, merge and comment-preserving write-back; nearest-ancestor discovery; monorepo walk-up.
- Package manager, typechecker, linter and formatter detection.
- `jyz config show|get|set|path|check`.

Gate: fixture-tree tests covering bun-only, pnpm-only, monorepo root plus member, and no-config projects across all three platforms; precedence test per layer; `jyz config check --strict` exits non-zero on an unknown key; `config set` on a commented file preserves the comments byte-exactly, and refuses on a file it cannot round-trip.

### M2 — Dispatch

- `install`, `add`, `remove`, `run`, `exec`, `update`, `outdated`, with dev-dependency flags, aliases, `[scripts]` overrides and `-F/--filter`.
- Exit-code and signal passthrough; inherited stdio; argv arrays, never a shell string.

Gate: table-driven tests asserting exact argv per verb per package manager, using stub binaries on `PATH` that record their arguments; monorepo `-F` and ambiguity tests; Windows CI green on the same table.

### M3 — Create

- Four families, prompts plus flag twins, monorepo assembly, all four git modes, `docs/` scaffold, generated `AGENTS.md`.

Gate: golden snapshot per template × package manager; every generated project passes `jyz check` and its own build in CI; a non-TTY run with a missing required value exits non-zero with a message instead of hanging on a prompt.

### M4 — Toolchain and parity

- `lint`, `typecheck`, `check` and `fmt`, alias polish, docs complete, capability manifest test.

Gate: resolver tests per typechecker (`bun check`, `tsc`, `tsgo`, `tsrs`) and per linter; an aggregate test proving `jyz check` runs both halves and reports both failures in a single run; the capability manifest proves every core operation is reachable from the CLI; three-platform CI green.

## v2 backlog

Desktop, MCP and opencode integration are specified now so their seams are designed in, and built after M4.

- Desktop consumes the installed CLI over its JSON-RPC surface and ships that CLI with the installer.
- MCP imports the core API in-process and adds streaming tools for long verbs.
- opencode integration drives sessions through the opencode client SDK.

## Non-goals for v1

- `publish`. Releasing is a CI and tag concern; it stays out of the command surface.
- Global installs. jyz acts on projects, not on a machine-wide toolchain.
- Reimplementing dependency resolution or lockfiles.
- Absorbing or generating native config files.
- Plugin system, remote execution, CI orchestration.

## Risks and open questions

- C/C++ layout is settled as standard extensions with both build files, but still untested against a real C project; revisit at M3 before snapshotting.
- `bun lint` and the tsgo/tsrs ports are canary, so the typechecker and linter lists will churn. An unavailable checker must be a clear error, never a silent fallback.
- Windows needs `.cmd` shim handling for pnpm and careful quoting; that is why Windows CI starts in M0 rather than at the end.
- The desktop installer carries the CLI, so app weight follows the CLI's runtime choice. Measure before bundling anything further.
- `--git github` adds a network step and an external dependency (`gh`) to `create`; it must fail loudly when unauthenticated rather than leaves a half-created project.
