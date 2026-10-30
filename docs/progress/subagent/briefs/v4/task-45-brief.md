## Task 45 — CI stops building alphas, and the gate follows the new shape

Owns: `scripts/verify-release.ts`, `scripts/alpha-release.ts`, `scripts/test/verify-release.test.ts`, `scripts/test/alpha-release.test.ts`, `.github/workflows/release.yml`.

- `verify-release.ts`: a published alpha is macOS-only, so demanding all four platform strings is wrong. `checkAssets(assets, version, options?)` gains `{ requireAllPlatforms?: boolean; latestPlatforms?: string[] }`; the default requires `core-`, `mcp-`, `cli-`, `mcp-` binary, `desktop-`, `latest.json` and at least one `.sig`, plus at least one known platform string; `--require-all` (CLI flag) adds the four-platform demand for stable releases. Keep `ok <tag> N assets`.
- `alpha-release.ts`: add `--local`, which after the tag is pushed runs `bun scripts/release-local.ts --tag v<version> --notes <generated notes file> --skip-gate` (gates already ran) and fails the whole command when that fails. Without `--local`, print the exact command to publish the alpha instead of pretending CI will.
- `.github/workflows/release.yml`: every job gets `if: ${{ !contains(github.ref_name, '-alpha') }}`, and a comment states that alphas ship from `scripts/release-local.ts` on the Mac while this matrix serves betas and stable.

Tests: `checkAssets` for a macOS-only asset list (passes by default, fails with `requireAllPlatforms`), for a list missing `latest.json`, and for a list with no platform string; `alpha-release`'s existing suites stay green.
