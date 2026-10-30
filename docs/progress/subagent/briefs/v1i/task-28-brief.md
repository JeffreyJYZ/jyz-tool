## Task 28 — alpha release automation

Owns: `scripts/alpha-release.ts`, `scripts/test/alpha-release.test.ts`.

One command that turns a green tree into a published alpha, without hand-editing six manifests:

- `bun scripts/alpha-release.ts [--push]` runs, in order: the four gates (`bun run typecheck`, `bun run lint`, `bun run format:check`, `bun run test`), stops on the first failure, then calls the existing bump logic for `0.1.0-alpha.N` → `alpha.N+1` across every manifest
- after a successful bump it commits `chore(release): <version>`, tags `v<version>`, and only pushes when `--push` is passed; without it, it prints the exact next commands and exits 0
- `--dry-run` prints the version it would produce and the gates it would run, changing nothing
- export pure helpers `nextAlpha(current: string): string` and `manifestFiles(): string[]` (the six manifest paths) so they are testable without git
- a dirty tree aborts before the first gate, naming the paths

Tests: `nextAlpha` for `0.1.0-alpha.1` → `0.1.0-alpha.2`, for a non-alpha version (throws with a clear message), for `alpha.9` → `alpha.10`; `manifestFiles` returns six paths that all exist; `--dry-run` prints without touching a file.
