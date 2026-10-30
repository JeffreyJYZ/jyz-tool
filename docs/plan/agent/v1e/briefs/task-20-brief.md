## Task 20 — verify-release script

Owns: `scripts/verify-release.ts`, `scripts/test/verify-release.test.ts`.

A committed, reusable check for a published release — the rules require one per releasing project, never an ad-hoc shell probe.

- `bun scripts/verify-release.ts [tag]` defaults the tag to the current package version as `v<version>` and the repo from `git remote get-url origin`
- fetches the release with `gh release view <tag> --json tagName,isPrerelease,assets,url` and asserts: the release exists, `tagName` matches, at least one `cli-` asset, at least one `desktop-` asset, and every expected platform suffix appears (`darwin-arm64`, `darwin-x64`, `linux-x64`, `windows-x64`)
- prints one verdict line (`ok <tag> <n> assets` or `missing: <what>`) and exits non-zero on any gap
- polls up to `--timeout <seconds>` (default 0, single check) with `--wait` enabling polling every 15s
- export the pure function `checkAssets(assets: {name: string}[], version: string): string[]` returning a list of problems, so it is testable without network

Tests: pure-function coverage for the happy path, a missing cli asset, a missing desktop asset, a missing platform, and an empty asset list.

