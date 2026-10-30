# jyz

Personal hub for projects: a scaffolder, one config file, and a CLI that behaves as whatever package manager a project already uses. One core powers the CLI, a desktop shell and an MCP server, so the surfaces cannot drift apart.

Version line: `0.1.0-alpha.x`. Latest release: [v0.1.0-alpha.8](https://github.com/JeffreyJYZ/jyz-tool/releases).

## Install

```sh
bun install -g jyz-tool        # once published; today, from a checkout:
bun link                        # inside packages/cli, then `jyz` is on PATH
```

The checkout path is what `bun link` points at, so editing `packages/cli/src` changes `jyz` immediately.

## Usage

```sh
jyz create my-cli --template cli --pm bun --yes
jyz install                     # delegates to the project's package manager
jyz add -D typescript
jyz run dev
jyz exec biome -- check .
jyz update --latest
jyz outdated
jyz lint / typecheck / check / fmt
jyz config show | get <key> | set <key> <value> | path | check --strict
jyz serve                        # JSON-RPC stdio, the desktop's machine surface
jyz oc sessions|prompt|watch [--json]   # drive the opencode server jyz talks to
```

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
packages/desktop  Tauri 2 shell: three screens (call, config, opencode) over `jyz serve`, with the CLI bundled as a sidecar
```

## Desktop and MCP

```sh
bun run --cwd packages/desktop build   # stages the CLI sidecar, then `tauri build`
bun run mcp                            # the MCP server from the checkout; hosts launch `jyz-mcp`
bun scripts/ui-walkthrough.ts          # drives all three screens in a browser (needs agent-browser)
```

The installer carries its own `jyz`, so the desktop never depends on the shell's `PATH`. Each GitHub release attaches `cli-` and `mcp-` binaries for five targets, plus `mcp-<version>.tgz` for hosts that would rather install the package.

## Development

```sh
bun install
bun run typecheck      # bun check
bun run lint           # biome check .
bun run format:check   # bun fmt --check
bun run test           # bun test
cd packages/desktop && bun run build      # Tauri bundles
bun run scripts/release.ts --all --publish   # build and publish artefacts
bun run scripts/verify-release.ts             # check a published release
```

## Docs

- Plan of record: [docs/plan/agent/main.md](docs/plan/agent/main.md)
- v1 milestone report: [docs/progress/reports/v1-milestone.md](docs/progress/reports/v1-milestone.md)
- Scaffold notes and traps: [docs/progress/notes/](docs/progress/notes/)

## License

Apache 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
