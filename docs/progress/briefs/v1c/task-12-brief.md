## Task 12 — MCP server over the core API

Owns: `packages/mcp/src/**`, `packages/mcp/test/**`.

`packages/mcp/package.json` already exists and depends on `@jyz/core`. Build a transport-free MCP handler layer:

- `src/tools.ts` exports `listTools(): ToolDefinition[]` — one tool per core capability (`jyz_install`, `jyz_add`, `jyz_remove`, `jyz_run`, `jyz_exec`, `jyz_update`, `jyz_outdated`, `jyz_create`, `jyz_config`, `jyz_typecheck`, `jyz_lint`, `jyz_check`, `jyz_fmt`), each with `name`, `description`, `inputSchema` (plain JSON Schema object) and `destructive: boolean`
- `src/handler.ts` exports `callTool(name: string, input: unknown, cwd: string): Promise<ToolResult>` returning structured data — `exitCode`, `argv`, `packageDir`, `stdout`, `stderr` — never scraped human text; `jyz_config` supports `show|get|set|check` via an `action` field; unknown tool names throw a typed error listing valid names
- resolution goes through core: `resolveProject`, `buildArgv`, `runCommand`, `buildCheckCommand`, `createProject`
- `src/index.ts` re-exports both

Tests: tool list covers every core dispatch verb exactly once; `callTool` on a fixture with a stub package manager records the same argv the CLI builds; unknown tool throws naming valid tools; `jyz_config` action routing.
