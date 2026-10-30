---
updated: 202610301700
version: 1.0
---

# jyz v1 close-out tasks

Closes the verification gaps left by wave 1 (`v1-tasks.md`). Three tasks, disjoint paths, all run in parallel. Controller owns `packages/core/src/index.ts`, `docs/**` and every commit.

## Global Constraints

- Bun only. TypeScript with `.ts` specifiers, tabs 4 wide, printWidth 100.
- Tests use `bun:test` and must pass with `bun test <your paths>`.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `bunfig.toml`, `.github/**`, `docs/**`, or another task's paths.
- No git commands, no commits, no subagents, no new dependencies.
- `jyz` is linked globally, so `jyz …` runs the working tree.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield between them.

## Task 9 — CLI end-to-end tests

Owns: `packages/cli/test/e2e/**`.

Spawn the real binary (`Bun.spawn(["bun", "packages/cli/src/bin.ts", ...], { cwd: fixtureDir })`) against throwaway fixture projects under `mkdtempSync`, and assert observable behaviour, not internals:

- `config show|get|set|path|check` — `set` on a commented `jyz.config.toml` keeps the comment; `check --strict` exits 1 on an unknown key
- dispatch verbs — put a stub `bun`/`pnpm` script on `PATH` that writes its argv to a file; assert `jyz add -D x` records `add -d x` for bun and `add -D x` for pnpm, `jyz update --latest` records `--latest`, exit code passes through (stub exits 3)
- `-F <name>` in a monorepo fixture acts on the named member's directory
- aliases: `[aliases] a = "add"` makes `jyz a x` behave as `add x`; an alias shadowing a core verb exits non-zero naming the alias
- bare script: `jyz dev` with `scripts.dev` in `package.json` runs it

Keep each spawn's stdio piped and assert on exit code plus recorded argv. Timeout each spawn.

## Task 10 — create: git modes, install, publishable

Owns: `packages/core/src/create/**`, `packages/core/test/create-git.test.ts`.

Implement in `createProject` what wave 1 deferred:

- `git: "init"` runs `git init` in the new dir; `"commit"` also `git add -A` and `git commit -m "chore: scaffold <name>"`; `"github"` additionally runs `gh repo create <name> --private --source . --remote origin --push`, printing the created URL
- a missing or unauthenticated `gh` fails before any file is written, naming the remedy; a `gh` that exits non-zero after the tree is written leaves the tree valid and reports which step failed
- `install: true` runs the detected package manager's install command in the new dir after writing
- `publishable: true` writes `bin`, `files`, `publishConfig.access`, `engines` and a pinned `packageManager` into `package.json`
- never call the network except for `github`

Tests stub `git`, `gh` and `bun` on `PATH` with recording scripts and assert the argv, plus the failure paths above. No real network, no real git repo needed.

## Task 11 — check aggregate and verbose toolchain output

Owns: `packages/core/src/funcs/toolchain.ts`, `packages/core/test/toolchain-aggregate.test.ts`, `packages/cli/src/commands/toolchain.ts`.

- `buildCheckCommand` returns one spec per applicable half, skipping a half whose tool is `none`
- `jyz check` runs every spec, prints each half under its own heading, exits non-zero if any half failed, and runs both even when the first fails
- when neither half applies it throws `ToolchainError` naming what was looked for
- `--verbose` on `lint`, `typecheck`, `check`, `fmt` prints each resolved command's argv and cwd before running, matching what dispatch verbs already print

Tests: both-halves fixture with a failing linter and a passing typechecker (assert both ran, exit non-zero, both headings appear), a `none` linter fixture (only typecheck runs), a nothing-configured fixture (throws), and a verbose-output shape assertion.
