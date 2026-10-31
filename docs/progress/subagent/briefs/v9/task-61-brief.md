## Task 61 — `scripts/release-local.ts` (393 lines)

Own: that file plus new modules under `scripts/release/`. Split the manifest and asset helpers from the build/publish orchestration; keep the exported pure helpers (`expectedTag`, `signatureVersion`, `assetPlan`, `refusals`, `requiredAssets`, `releaseAssets`, `uptodateDmgName`) importable from `scripts/release-local.ts` so its test keeps passing unchanged.
