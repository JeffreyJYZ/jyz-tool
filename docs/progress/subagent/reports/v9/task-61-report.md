# Task 61 report

Split `scripts/release-local.ts` into `scripts/release/{helpers,build,publish,run}.ts`. Pure helpers re-exported from `scripts/release-local.ts`; behaviour unchanged.

Gates: `bun test scripts/test` 77 pass; `bun run size` clean; `bun check` clean; `bun run lint`/`bun fmt --check` carry pre-existing unrelated errors.
