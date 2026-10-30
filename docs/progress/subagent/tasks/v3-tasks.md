---
updated: 202610310040
version: 1.0
---

# jyz v3 — the app updates itself

Matches what Quarry already does: `tauri-plugin-updater`, signed updater artefacts, a release endpoint, and an in-app check → install → restart. Three tasks, disjoint paths.

Reference implementation (read it, do not edit it): `~/dev/monorepos/quarry` — `src-tauri/tauri.conf.json` (`plugins.updater`), `src-tauri/Cargo.toml`, `src-tauri/src/lib.rs` (plugin registration), `src/lib/updates/store.ts` (check/download/restart flow), `.github/workflows/release.yml` (signing env).

Controller owns `.github/workflows/release.yml`, root manifests, `packages/cli/**`, `docs/**` and every commit. The signing key already exists at `~/.config/jyz/updater.key` (private, never commit it) with its public half at `~/.config/jyz/updater.key.pub`; the CI secret `TAURI_SIGNING_PRIVATE_KEY` is set.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `.github/**`, `docs/**`, or another task's paths.
- No new JS dependencies; the one Rust dependency is named below. No git commands, no commits, no subagents.
- Never print, copy or commit the private key.
- Verify with `bun test <your paths>`; `bun check` must stay clean on your files.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Shared contract

- `plugins.updater.pubkey` is the **whole contents** of `~/.config/jyz/updater.key.pub` (one base64 line), and `endpoints` is exactly `["https://github.com/JeffreyJYZ/jyz-tool/releases/latest/download/latest.json"]`.
- Rust commands, called from the page as `invoke("jyz_update_check")` and `invoke("jyz_update_install")`:
    - `jyz_update_check() -> Result<Option<UpdateOffer>, String>` where `UpdateOffer = { current: string; version: string; notes: string | null }`; `None` means already current, and a network failure is `Err` with the reason.
    - `jyz_update_install() -> Result<(), String>` downloads, installs and restarts the app.
- The release publishes `latest.json` and one `.sig` beside every updater artefact.

## Task 41 — the Rust side and the bundle config

Owns: `packages/desktop/src-tauri/src/lib.rs`, `packages/desktop/src-tauri/tauri.conf.json`, `packages/desktop/src-tauri/Cargo.toml`, `scripts/test/updater-config.test.ts`.

- Add `tauri-plugin-updater = "2"` and register it in the builder chain before `run()`.
- `tauri.conf.json`: `bundle.createUpdaterArtifacts: true` and a `plugins.updater` block with the pubkey and endpoint from the shared contract.
- Implement `jyz_update_check` and `jyz_update_install` with the signatures above. Check must not download; install must emit nothing to stdout and must not restart when the install fails. Read the pubkey from the config, not from an environment variable.
- Rust unit tests: the offer shape serializes the three fields, and a missing config key is reported as an error rather than a panic.

`scripts/test/updater-config.test.ts` asserts from the repo root: `createUpdaterArtifacts` is true, the pubkey decodes from base64 and starts with `untrusted comment:`, the endpoint is the GitHub URL, the Cargo manifest carries the plugin, and `lib.rs` registers it.

Validate with `cargo check` and `cargo fmt --check` in `packages/desktop/src-tauri` and quote both.

## Task 42 — the window says an update is available

Owns: `packages/desktop/ui/index.html`, `packages/desktop/src/updates.ts`, `packages/desktop/test/updates.test.ts`.

- `src/updates.ts` exports `describeUpdate(offer: { current: string; version: string; notes: string | null } | null): { headline: string; detail: string } | null` (`null` when there is nothing to offer), and `updateCheckFailed(error: unknown): string` for the one-line failure message.
- The page calls `invoke("jyz_update_check")` once after the version footer resolves. When an offer comes back, a banner above the tab strip says `update available: <version>` with an **Install** button; pressing it calls `invoke("jyz_update_install")`, disables the button, and shows `installing… the app will restart`. A failed check renders nothing (never a red banner on a machine without a release endpoint). Keep the page framework-free, one `<script>`, dark theme, existing CSS vocabulary.
- Degrade cleanly when `__TAURI_INTERNALS__` is absent: no banner, no error.

Tests: `describeUpdate` for an offer, for null, and with a null `notes`; `updateCheckFailed` for an `Error` and for a string; tabs still map from the hash.

## Task 43 — the release ships updater artefacts

Owns: `scripts/release.ts`, `scripts/verify-release.ts`, `scripts/test/release-updater.test.ts`.

- `release.ts` collects `.sig` files and `latest.json` from the Tauri bundle directory alongside the installers, so they reach the GitHub release. Name the log line so a missing signature is visible.
- `verify-release.ts` asserts, for the tag's version: `latest.json` exists in the asset list, and at least one `.sig` accompanies it; report a concrete problem string per missing piece.
- `release.test.ts` is not a thing here: put new cases in `scripts/test/release-updater.test.ts` and cover the pure helper you add (e.g. `collectUpdaterExtras(names: string[]): string[]` and the new `checkAssets` cases), keeping the existing `verify-release.test.ts` green.
