# Task 44 — local macOS alpha release

Status: done.

Files: `scripts/release-local.ts` (340 lines), `scripts/test/release-local.test.ts`.

Tests: 7 pass, 0 fail.

Flow: version + tag check, signing-key presence, the four gates unless `--skip-gate`, a signed `bun run --cwd packages/desktop build -- --bundles app` unless `--skip-build`, a Finder-free `hdiutil` dmg, `scripts/release.ts` then `scripts/updater-manifest.ts --partial` and `--merge`, signature and mtime refusals, `gh release create|upload` with `--prerelease`, then ten attempts at the public `latest.json` with a version match.

Concerns: none. Tests cover the pure helpers only; the orchestration is exercised by running the command, never by a unit test.
