# jyz v1 — milestone report

Date: 2026-10-30. Version line: `0.1.0-alpha.x`, currently `0.1.0-alpha.7`.

## What v1 delivers

- **Config** — `jyz.config.toml` loaded with five-layer precedence (flag, env, nearest file, detection, default), layered across a monorepo (root config merges with member config so `[aliases]` and `[scripts]` inherit), comment-preserving `config set` that refuses rather than rewrite a file it cannot round-trip.
- **Detection** — package manager from lockfiles, typechecker/linter/formatter from their own config files; two signals of the same kind is a warning the config can settle, not a dead end.
- **Dispatch** — `install`, `add` (with `-D`), `remove`/`rm`, `run`, `exec`/`x`, `update` (`--latest`), `outdated`, all with `-F/--filter`; argv arrays, no shell strings, exit code and signals mirrored.
- **Create** — five template families (`cli`, `next`, `cargo-bin`, `c`, `monorepo`) with `.tmpl` sources, prompts plus flag twins, `--yes` defaults from config, `--install`, `--publishable`, and all four git modes including `--git github` through `gh`.
- **Toolchain** — `lint`, `typecheck`, `check` (the aggregate: both halves, both failures reported, `none` skipped) and `fmt` with a read-only `--check`.
- **Machine surfaces** — `jyz serve` speaks newline-delimited JSON-RPC 2.0 over stdio, resolving capability calls without spawning; `listCapabilities()` in core is the parity manifest; the MCP package exposes tool listing and invocation over stdio.
- **Release** — tag-driven, three-OS matrix, compiled CLI per platform plus Tauri installers, release body generated from git history, `verify-release` as a committed command.

## Gate results at commit `14a44eb`

- `bun run typecheck` — no type errors in 72 files
- `bun run lint` — exit 0 (warnings only)
- `bun run format:check` — 152 files formatted
- `bun run test` — 191 pass, 0 fail, 24 files

## Releases

| Tag | State |
| --- | --- |
| `v0.1.0-alpha.1` | published, 12 assets |
| `v0.1.0-alpha.2` | published, 12 assets, `verify-release` verdict `ok v0.1.0-alpha.2 12 assets` |
| `v0.1.0-alpha.3` | published after two failed attempts (below) |
| `v0.1.0-alpha.4` | published, 12 assets, `ok v0.1.0-alpha.4 12 assets` |
| `v0.1.0-alpha.5` | published, 12 assets, `ok v0.1.0-alpha.5 12 assets` |
| `v0.1.0-alpha.6` | published, 18 assets, `ok v0.1.0-alpha.6 18 assets` — first release with MCP binaries |
| `v0.1.0-alpha.7` | published, 18 assets — desktop click-through script and the Windows-safe sidecar stage |

## Failures worth remembering

- `bunx tauri` resolves the npm package `tauri`, not `@tauri-apps/cli`; it pulled a `sharp` source build. Use the package's own script.
- `.deb` rejects a hyphen in a version and `.msi` needs a numeric pre-release, so bundles build as `0.1.0` while tags stay `0.1.0-alpha.N`.
- Windows CI failed on CRLF until `.gitattributes` forced `eol=lf`.
- An e2e test hardcoded `/Users/jyz/dev/jyz/...`, so it could only pass on this machine. Derive paths from `import.meta.dir`.
- Committing while an implementer was still writing put a tag on a tree that did not typecheck. Wait for the report, then gate, then tag.

## Known gaps

- The desktop window does not call `jyz serve` yet; that bridge is wave 5.
- `--git github` is covered by stubs, never against a real remote.
- opencode integration is specified but unbuilt.
- Rust is outside every gate: no `cargo fmt`, `clippy` or `check` in CI.
- `jyz lint` and `jyz check` only know the tools wired in `toolchain.ts`; the linter list is narrower than the plan's.
