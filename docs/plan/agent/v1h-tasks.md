---
updated: 202610302200
version: 1.0
---

# jyz v1h — MCP resources over stdio, UI manifest, monorepo create coverage

Three parallel tasks, disjoint paths. Controller owns `package.json`, `packages/core/src/index.ts`, `packages/cli/**`, `docs/**`, `.github/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, or another task's paths.
- No git commands, no commits, no subagents, no new dependencies, no network in tests.
- Verify with `bun test <your paths>`; `bun check` must stay clean.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Task 25 — MCP resources over stdio

Owns: `packages/mcp/src/stdio.ts`, `packages/mcp/src/server.ts`, `packages/mcp/test/resources-stdio.test.ts`.

`packages/mcp/src/resources.ts` already exposes `listResources()` and `readResource(uri)`; the stdio loop does not serve them yet.

- `resources/list` returns `{ resources: [{ uri, name, description, mimeType }] }`
- `resources/read` takes `{ uri }` and returns `{ contents: [{ uri, mimeType, text }] }`, mapping an unknown URI to a JSON-RPC error with code `-32602` and the message from the typed error
- `initialize` advertises `capabilities.resources = { listChanged: false }`
- malformed params (missing `uri`, wrong type) return `-32602`, never throw out of the loop

Tests: an in-memory pipe drives list then read for both URIs, an unknown URI, and a malformed request; the loop stays alive after each error.

## Task 26 — desktop UI reads the real manifest

Owns: `packages/desktop/ui/index.html`, `packages/desktop/src/bridge.ts`, `packages/desktop/test/bridge.test.ts`.

The window currently carries a hardcoded method list. Replace it so the UI cannot drift from core:

- `bridge.ts` exports `methodsFromManifest(manifest: { name: string; kind: string }[]): string[]` returning names in manifest order, and `groupByKind(manifest)` for section grouping
- drop the hardcoded `METHODS` array and derive the select options from the manifest passed into the page (the Rust side supplies it; keep a small inline fallback only if the manifest is empty)
- the page renders one `<optgroup>` per kind
- tests cover ordering, empty manifest fallback, and grouping

Do not edit `packages/desktop/src-tauri/**`.

## Task 27 — monorepo create coverage

Owns: `packages/core/test/create-monorepo.test.ts`.

Tests only, no source edits; report any real bug instead of fixing it.

- `createProject` with `template: "monorepo"` writes a root with members, each member rendered from its own template code path
- root carries `jyz.config.toml` and, when a member is JS, a root `package.json`
- `docs/` is skipped unless requested, and appears once at the root, not per member
- a member that would scaffold into an existing non-empty directory throws before writing anything
- two runs into different temp dirs produce identical file lists
