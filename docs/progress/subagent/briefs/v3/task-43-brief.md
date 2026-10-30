## Task 43 — the release ships updater artefacts

Owns: `scripts/release.ts`, `scripts/verify-release.ts`, `scripts/test/release-updater.test.ts`.

- `release.ts` collects `.sig` files and `latest.json` from the Tauri bundle directory alongside the installers, so they reach the GitHub release. Name the log line so a missing signature is visible.
- `verify-release.ts` asserts, for the tag's version: `latest.json` exists in the asset list, and at least one `.sig` accompanies it; report a concrete problem string per missing piece.
- `release.test.ts` is not a thing here: put new cases in `scripts/test/release-updater.test.ts` and cover the pure helper you add (e.g. `collectUpdaterExtras(names: string[]): string[]` and the new `checkAssets` cases), keeping the existing `verify-release.test.ts` green.
