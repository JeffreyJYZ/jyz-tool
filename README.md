# jyz

Personal hub for projects: a scaffolder, one config file, and a CLI that behaves as whatever package manager a project already uses. One core powers the CLI, a desktop shell and an MCP server, so the surfaces cannot drift apart.

Version line: `0.1.0-alpha.x`. Latest release: [v0.1.0-alpha.21](https://github.com/JeffreyJYZ/jyz-tool/releases).

## Install

```sh
bun install -g jyz-tool        # once published; today, from a checkout:
cd packages/cli && bun link     # then `jyz` is on PATH
```

The checkout path is what `bun link` points at, so editing `packages/cli/src` changes `jyz` immediately.

## Usage

```sh
jyz create my-app --template vite-tauri --feature updater
jyz create my-cli --template cli --feature cac-cli
jyz create . --template next --features updater,cac-cli
jyz create --list-features
jyz install                     # delegates to the project's package manager
jyz add -D typescript
jyz run dev
jyz exec biome -- check .
jyz update --latest
jyz outdated
jyz lint / typecheck / check / fmt
jyz config show | get <key> | set <key> <value> | path | check --strict
jyz serve                        # JSON-RPC stdio, the desktop's machine surface
jyz serve --execute              # also run a resolved command
jyz oc sessions|prompt|watch [--json]
```

`jyz create` takes `--template`, `--feature` (repeatable), `--features a,b` and `--list-features`; with no feature flag on a TTY it asks interactively. Templates: `next`, `cli`, `rust-bin`, `c`, `monorepo`, `vite-tauri`. Features: `updater` (vite-tauri), `cac-cli` (cli, monorepo).

Every dispatch verb takes `-F/--filter <name>` in a monorepo and `--verbose` to print the exact argv.

## Config

`jyz.config.toml`, nearest file wins, root file merges with a member's in a monorepo:

```toml
[project]
package_manager = "auto"   # auto | bun | pnpm
typechecker = "auto"       # auto | bun-check | tsc | tsgo | tsrs | cargo | clang
linter = "biome"           # biome | eslint | bun-lint | cargo-clippy | clang-tidy | none
formatter = "biome"        # biome | bun-fmt | prettier | clang-format | rustfmt | none

[aliases]
a = "add"

[scripts]
e2e = "bun test --timeout 60000"
```

Precedence: flag, environment (`JYZ_PACKAGE_MANAGER`, …), config file, detection, default. Unknown keys warn; `config check --strict` makes them errors.

## Packages

```
packages/core     every capability: config, detection, dispatch, toolchain, create, capabilities
packages/cli      cac-based adapter over core, plus the JSON-RPC serve mode
packages/mcp      MCP tools, resources and a stdio server over core; ships a `jyz-mcp` bin
packages/desktop  Tauri 2 shell over `jyz serve`, Vite + TypeScript, no framework; CLI bundled as a sidecar
```

## Desktop and MCP

```sh
bun run --cwd packages/desktop build   # stages the CLI sidecar, then `tauri build`
bun run mcp                            # the MCP server from the checkout; hosts launch `jyz-mcp`
bun scripts/ui-walkthrough.ts          # drives all three screens in a browser (needs agent-browser)
```

The installer carries its own `jyz`, so the desktop never depends on the shell's `PATH`. Each GitHub release attaches `cli-` and `mcp-` binaries for five targets, plus `mcp-<version>.tgz` for hosts that would rather install the package. The window can run a resolved command via the **Run it** checkbox on the Call screen (off by default). Self-update ships signed releases with `latest.json`, a Settings screen with a manual check, and installs in place.

## Development

```sh
bun install
bun run typecheck      # bun check
bun run lint           # biome check .
bun run format:check   # bun fmt --check
bun run test           # bun test
bun run size           # 200-line limit; docs/refactor/oversized.txt must stay empty
bun scripts/scaffold-smoke.ts   # scaffold a vite-tauri app with the updater, run cargo check
cd packages/desktop && bun run build      # Tauri bundles
bun run scripts/release.ts --all --publish   # build and publish artefacts
bun run scripts/verify-release.ts             # check a published release
```

## Docs

- Plan of record: [docs/plan/agent/main.md](docs/plan/agent/main.md)
- v1 milestone report: [docs/progress/subagent/reports/v1-milestone.md](docs/progress/subagent/reports/v1-milestone.md)
- Scaffold notes and traps: [docs/progress/notes/](docs/progress/notes/)

## License

Apache 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
