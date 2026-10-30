## Task 34 — MCP distribution manifest

Owns: `packages/mcp/package.json`, `packages/mcp/src/bin.ts`, `packages/mcp/README.md`, `packages/mcp/test/bin.test.ts`, `scripts/test/mcp-package.test.ts`.

The server runs from a repo checkout today. Make it installable and shippable:

- `packages/mcp/package.json` gains `bin: { "jyz-mcp": "./src/bin.ts" }`, `description`, `license`, `engines.bun`, `files` covering `src/**` and `README.md`, `publishConfig.access: "public"`, and keeps `private: true` until a publish decision is made (note that in the README).
- `src/bin.ts` is a thin, documented entry: `#!/usr/bin/env bun`, resolves the project directory from `--cwd <dir>` then `JYZ_MCP_CWD` then `process.cwd()`, and calls `startServer(cwd)` from `server.ts`. It must not re-implement the loop.
- `README.md` states what the server is, how to run it from a checkout (`bun packages/mcp/src/bin.ts`), how a host points at it (`command: jyz-mcp`, no args), and that standalone binaries are attached to each GitHub release by `scripts/release.ts`.

Tests: the manifest invariants (bin path exists, has a shebang, `files` includes `src`, engines and publishConfig present); `bun packages/mcp/src/bin.ts` driven over stdio answers an `initialize` handshake and lists 15 tools; `--cwd <tmp>` wins over the environment. A second test file asserts the same invariants by reading the manifest from the repo root, so a broken package cannot ship.

Do not edit `scripts/release.ts`; the controller wires the compiled binaries.
