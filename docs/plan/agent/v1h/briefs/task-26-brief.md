## Task 26 — desktop UI reads the real manifest

Owns: `packages/desktop/ui/index.html`, `packages/desktop/src/bridge.ts`, `packages/desktop/test/bridge.test.ts`.

The window currently carries a hardcoded method list. Replace it so the UI cannot drift from core:

- `bridge.ts` exports `methodsFromManifest(manifest: { name: string; kind: string }[]): string[]` returning names in manifest order, and `groupByKind(manifest)` for section grouping
- drop the hardcoded `METHODS` array and derive the select options from the manifest passed into the page (the Rust side supplies it; keep a small inline fallback only if the manifest is empty)
- the page renders one `<optgroup>` per kind
- tests cover ordering, empty manifest fallback, and grouping

Do not edit `packages/desktop/src-tauri/**`.
