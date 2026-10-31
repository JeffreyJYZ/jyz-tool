---
updated: 202610311430
version: 1.0
---

# jyz v8 — features chosen at scaffold time

`jyz create` renders a template and stops. This adds a feature selection to that same path: the scaffold can also graft an auto-updating Tauri app or a cac-based CLI entry, chosen by flag, before it prints what it wrote.

Two tasks, disjoint paths. Controller owns `packages/core/src/index.ts`, `packages/cli/src/bin.ts`, `packages/core/src/funcs/capabilities.ts`, `docs/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- **Every file under 200 lines** — `bun run size` is a gate now; split rather than exceed.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, or another task's paths.
- No new dependencies, no git commands, no commits, no subagents, no network.
- Verify with `bun test <your paths>`, `bun check`, `bun run size`; lint stays clean.

## Shared contract

- Feature ids: `updater` (Tauri only) and `cac-cli` (JS CLI only). Each declares which templates accept it.
- `jyz create <name> --feature updater --feature cac-cli` (repeatable) and `--features a,b`; unknown id or an id the chosen template cannot take fails **before anything is written**, naming both sides.
- Applying is idempotent: a second run reports `already applied` per file instead of duplicating blocks.
- JSON create output gains `features: { name, applied: boolean, files: string[] }[]`.

What `updater` grafts into a `vite-tauri` project:

- `src-tauri/Cargo.toml`: `tauri-plugin-updater = "2"`.
- `src-tauri/src/updater.rs`: `pub struct UpdateOffer { current, version, notes }`, `pub async fn check_for_update(app) -> Result<Option<UpdateOffer>, String>` and `pub async fn install_update(app) -> Result<(), String>`, plus the two `#[tauri::command]` wrappers. Small and dependency-free beyond the plugin.
- `src-tauri/src/lib.rs`: `mod updater;`, `.plugin(tauri_plugin_updater::Builder::new().build())`, the two commands in the invoke handler.
- `src-tauri/tauri.conf.json`: `bundle.createUpdaterArtifacts: true` and a `plugins.updater` block with a `<PLACEHOLDER_PUBKEY>` value and a `latest.json` endpoint derived from the project name.
- `README` note (append, never overwrite) naming the missing steps: generate a key, put the pubkey in the config, set the signing secret in CI.

What `cac-cli` grafts into a `cli` project:

- `src/bin.ts`: `#!/usr/bin/env bun`, `cac("<name>")`, `-v/--version` from the package version, one example command, `cli.help()` and `cli.parse()`.
- `package.json`: `bin: { "<name>": "./src/bin.ts" }` and a `dev` script, merged into the existing file rather than replacing it.
- One smoke test that imports the module and asserts the program name.

## Task 52 — the feature registry and the two appliers

Owns: `packages/core/src/features/**` (new), `packages/core/src/create/index.ts`, `packages/core/src/create/features.ts` (new if useful), `packages/core/test/features*.test.ts`.

- `listFeatures(): { id, summary, templates: Template[] }[]`, `applyFeatures(dir, ids, ctx)` idempotent, and validation that runs before the template writes anything.
- Pure where possible: the appliers take a small context (`read`, `write`, `exists`, `join`) so tests drive them against a temp dir.
- `create` accepts `features?: string[]` and returns what it applied.

Tests: each applier on a fixture tree (Cargo.toml, lib.rs, tauri.conf.json, package.json), idempotency by running twice, an unknown id, and an id the template cannot take — the last two must throw a typed error with both names in the message and write nothing.

## Task 53 — the flags on `jyz create`

Owns: `packages/cli/src/commands/create.ts`, `packages/cli/test/create-features.test.ts`.

- `--feature <name>` (repeatable) and `--features <a,b>`, merged and de-duplicated.
- `--list-features` prints `id  template(s)  summary` and exits 0 without creating anything.
- Unknown or incompatible feature: non-zero exit, message naming the feature and the template, nothing written on disk.
- `--json` output carries the `features` array from the shared contract.
- A `create` with no features behaves byte-for-byte as it does today.

Tests drive the real command against a temp cwd: one feature applied, both, an unknown id, a template mismatch, and `--list-features`.
