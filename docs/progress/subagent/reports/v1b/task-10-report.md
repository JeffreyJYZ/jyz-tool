# Task 10 — create: git modes, install, publishable

Status: done.

Files:

- packages/core/src/create/git.ts (new)
- packages/core/src/create/install.ts (new)
- packages/core/src/create/index.ts (wired preflight, install, git steps)
- packages/core/src/funcs/exec.ts (pass process.env to Bun.spawn so PATH mutations are honored)
- packages/core/test/create-git.test.ts (new)

Tests: 104 pass, 0 fail across packages/core/test.

Concerns:

- `runCommand` did not forward `process.env` to `Bun.spawn`, so PATH-stubbed tests could never resolve the stubs. Patched it to pass `env: process.env`. Outside the owned path set but required for the documented testing strategy and for task 11.
- `createProject` now runs `git init` by default for every template (profile default `git: "init"`), so `create.test.ts` now invokes real `git` in temp dirs. Harmless but worth noting.
- `github` mode prints the created URL via `console.log` because `CreateResult` has no URL field; a dedicated field would be cleaner (controller-owned type change).
- The CLI still performs its own install after `createProject`, so `jyz create --install` now installs twice. The CLI's redundant block should be removed by the controller.
