## Task 27 — monorepo create coverage

Owns: `packages/core/test/create-monorepo.test.ts`.

Tests only, no source edits; report any real bug instead of fixing it.

- `createProject` with `template: "monorepo"` writes a root with members, each member rendered from its own template code path
- root carries `jyz.config.toml` and, when a member is JS, a root `package.json`
- `docs/` is skipped unless requested, and appears once at the root, not per member
- a member that would scaffold into an existing non-empty directory throws before writing anything
- two runs into different temp dirs produce identical file lists
