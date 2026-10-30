## Task 10 — create: git modes, install, publishable

Owns: `packages/core/src/create/**`, `packages/core/test/create-git.test.ts`.

Implement in `createProject` what wave 1 deferred:

- `git: "init"` runs `git init` in the new dir; `"commit"` also `git add -A` and `git commit -m "chore: scaffold <name>"`; `"github"` additionally runs `gh repo create <name> --private --source . --remote origin --push`, printing the created URL
- a missing or unauthenticated `gh` fails before any file is written, naming the remedy; a `gh` that exits non-zero after the tree is written leaves the tree valid and reports which step failed
- `install: true` runs the detected package manager's install command in the new dir after writing
- `publishable: true` writes `bin`, `files`, `publishConfig.access`, `engines` and a pinned `packageManager` into `package.json`
- never call the network except for `github`

Tests stub `git`, `gh` and `bun` on `PATH` with recording scripts and assert the argv, plus the failure paths above. No real network, no real git repo needed.
