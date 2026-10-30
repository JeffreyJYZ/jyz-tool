---
updated: 202610310130
version: 1.0
---

# jyz v4 — alphas are built and published locally on this Mac

Quarry's strategy, copied: an alpha does not need a three-OS matrix, so it is built here, signed here and published here; CI keeps the full matrix for non-alpha tags. Reference (read, never edit): `~/dev/monorepos/quarry/scripts/release-local.ts`, `scripts/release-manifest.ts`, `.github/workflows/release.yml` (the `-alpha` tag guard), `docs/plans/008-release-checklist.md`.

Controller owns root manifests, `docs/**`, `packages/**` and every commit.

## Global Constraints

- Bun only; `.ts` specifiers, tabs 4 wide, printWidth 100, bun:test.
- Never edit `package.json`, `tsconfig.json`, `biome.json`, `packages/**`, `docs/**`.
- No new dependencies. No git commits. No `gh release` calls in a test. No network in tests.
- Never print, copy or commit the private key at `~/.config/jyz/updater.key`.
- Verify with `bun test <your paths>`; `bun check` must stay clean on your files.
- Do as much as possible in one turn: batch independent calls, chain dependent steps, never yield.

## Shared facts

- Version source is `package.json`; the tag scheme stays `v<version>`, so an alpha is `v0.1.0-alpha.11`. The four manifests are bumped by `scripts/alpha-release.ts`.
- A local macOS build keeps the real `0.1.0-alpha.N` version: `--bundles app` produces no `.deb`/`.msi`, so the `0.1.0` override that CI needs does not apply here.
- `bun run --cwd packages/desktop build -- --bundles app` stages the CLI sidecar first, then bundles. With `TAURI_SIGNING_PRIVATE_KEY` set, Tauri writes `jyz.app.tar.gz` and `jyz.app.tar.gz.sig` beside `bundle/macos/jyz.app`.
- `scripts/release.ts` (no flags) already builds `cli-` and `mcp-` for the host target, collects every desktop installer, and copies updater partials as `latest-<platform>.json`.
- `scripts/updater-manifest.ts` merges those partials into `dist/release/latest.json`.

## Task 44 — `scripts/release-local.ts`

Owns: `scripts/release-local.ts` (new), `scripts/test/release-local.test.ts` (new).

One command that turns a green tree into a published macOS alpha:

- Steps in order: version + tag check, signing-key presence, gate (`bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run test`) unless `--skip-gate`, build unless `--skip-build`, dmg, artefact checks, `bun scripts/release.ts`, `bun scripts/updater-manifest.ts`, publish unless `--skip-publish`, then verify the public manifest.
- Build env: `TAURI_SIGNING_PRIVATE_KEY` = the key path, `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` = empty.
- The dmg is made with `hdiutil create -volname jyz -srcfolder <jyz.app> -ov -format UDZO`, never Tauri's Finder-driven dmg step; afterwards detach any mounted `/Volumes/jyz*` volume.
- Before publishing, refuse when: the `.sig` decodes to a version other than this one, the archive is older than the app binary, the signature is empty, or the dmg is missing. Each refusal names the file and the reason.
- Publish with `gh release create` (`--prerelease`, notes from `git log` since the previous tag) or `gh release upload --clobber` plus `gh release edit` when the release already exists.
- After publishing, fetch `https://github.com/JeffreyJYZ/jyz-tool/releases/latest/download/latest.json` up to ten times, 5 s apart, and fail unless `version` equals this version and every platform entry carries a signature and a url.
- Export pure helpers so bun:test covers the judgement without touching github: `expectedTag(version: string): string`, `signatureVersion(signature: string): string | null`, `assetPlan(version: string, dmgName: string): { file: string; name: string }[]`, `refusals(input: { signature: string; version: string; archiveMtime: number; appMtime: number; dmgName: string | null }): string[]`.
- Flags: `--skip-gate`, `--skip-build`, `--skip-publish`, `--tag <tag>`, `--notes <file>`.

Tests: `expectedTag` for an alpha and a stable version; `signatureVersion` on a real base64 body containing `version:X` and on junk; `assetPlan` names the tarball, its `.sig`, the dmg and `latest.json`; `refusals` returns one message per broken input and `[]` when everything is right.

## Task 45 — CI stops building alphas, and the gate follows the new shape

Owns: `scripts/verify-release.ts`, `scripts/alpha-release.ts`, `scripts/test/verify-release.test.ts`, `scripts/test/alpha-release.test.ts`, `.github/workflows/release.yml`.

- `verify-release.ts`: a published alpha is macOS-only, so demanding all four platform strings is wrong. `checkAssets(assets, version, options?)` gains `{ requireAllPlatforms?: boolean; latestPlatforms?: string[] }`; the default requires `core-`, `mcp-`, `cli-`, `mcp-` binary, `desktop-`, `latest.json` and at least one `.sig`, plus at least one known platform string; `--require-all` (CLI flag) adds the four-platform demand for stable releases. Keep `ok <tag> N assets`.
- `alpha-release.ts`: add `--local`, which after the tag is pushed runs `bun scripts/release-local.ts --tag v<version> --notes <generated notes file> --skip-gate` (gates already ran) and fails the whole command when that fails. Without `--local`, print the exact command to publish the alpha instead of pretending CI will.
- `.github/workflows/release.yml`: every job gets `if: ${{ !contains(github.ref_name, '-alpha') }}`, and a comment states that alphas ship from `scripts/release-local.ts` on the Mac while this matrix serves betas and stable.

Tests: `checkAssets` for a macOS-only asset list (passes by default, fails with `requireAllPlatforms`), for a list missing `latest.json`, and for a list with no platform string; `alpha-release`'s existing suites stay green.
