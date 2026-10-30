# @jyz/mcp

stdio MCP server exposing jyz project tools to AI hosts.

## Run from a checkout

```sh
bun packages/mcp/src/bin.ts
```

## Host configuration

Point the host at the installed binary with no arguments:

```json
{ "command": "jyz-mcp" }
```

The working directory is resolved from `--cwd <dir>`, then `JYZ_MCP_CWD`, then the current directory.

## Installable but private

This package keeps `private: true` until a publish decision is made. Standalone binaries are attached to each GitHub release by `scripts/release.ts`.
