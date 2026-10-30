## Task 14 — monorepo and path edge-case tests

Owns: `packages/core/test/monorepo.test.ts`, `packages/core/test/paths.test.ts`.

Write tests only; if a test exposes a real bug, report it in the report file instead of editing sources.

- nested monorepos: root config applies, member config overrides `[project]`, member inherits root `[aliases]`
- `-F` matching by directory name and by `package.json` name, plus zero-match and multi-match errors listing candidates
- a package nested three levels deep resolves to itself, not to the repo root
- paths with spaces and unicode resolve correctly through `resolveProject`, `findConfigPath` and `buildArgv`
- `node_modules/.bin` lookup walks up across workspace boundaries
