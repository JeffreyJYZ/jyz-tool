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
