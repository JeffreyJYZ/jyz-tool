## Task 52 — the feature registry and the two appliers

Owns: `packages/core/src/features/**` (new), `packages/core/src/create/index.ts`, `packages/core/src/create/features.ts` (new if useful), `packages/core/test/features*.test.ts`.

- `listFeatures(): { id, summary, templates: Template[] }[]`, `applyFeatures(dir, ids, ctx)` idempotent, and validation that runs before the template writes anything.
- Pure where possible: the appliers take a small context (`read`, `write`, `exists`, `join`) so tests drive them against a temp dir.
- `create` accepts `features?: string[]` and returns what it applied.

Tests: each applier on a fixture tree (Cargo.toml, lib.rs, tauri.conf.json, package.json), idempotency by running twice, an unknown id, and an id the template cannot take — the last two must throw a typed error with both names in the message and write nothing.
