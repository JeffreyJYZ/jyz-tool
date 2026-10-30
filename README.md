# jyz

Personal hub for projects: a scaffolder, one config file, and a CLI that behaves as whatever package manager a project already uses. A single core powers the CLI, a desktop app and an MCP server, so the surfaces cannot drift apart.

Status: scaffolding only. The CLI runs and prints help, the desktop package is a placeholder, and nothing else is implemented yet. The plan of record is [docs/plan/agent/main.md](docs/plan/agent/main.md).

## Commands

```sh
bun install
bun run jyz --version    # jyz/0.1.0-alpha.1 darwin-arm64 bun-v...
bun run jyz              # help
bun run typecheck        # bun check
bun run lint             # biome check .
bun run format:check     # bun fmt --check
```

## Layout

```
packages/core     capabilities live here; thin adapters call in
packages/cli      cac-based CLI adapter
packages/desktop  Tauri shell, arrives at v2
```

## License

Apache 2.0, see [LICENSE](LICENSE) and [NOTICE](NOTICE).
