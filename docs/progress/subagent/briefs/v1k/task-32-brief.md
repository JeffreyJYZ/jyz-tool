## Task 32 — the desktop window gets the manifest from the CLI

Owns: `packages/desktop/src-tauri/src/{lib.rs,linux_process.rs}`, `packages/desktop/ui/index.html`, `packages/desktop/src/bridge.ts`, `packages/desktop/test/{bridge,parity}.test.ts`.

The UI currently falls back to a hardcoded list because nothing supplies the manifest. Close it:

- a Tauri command `jyz_capabilities()` runs `jyz capabilities --json`, parses it, and returns the array; a non-zero exit or bad JSON returns an empty array rather than throwing into the page
- `lib.rs` passes the manifest to the window (either through an initialization script or an `invoke` the page performs on load — pick one and document why in a comment)
- `ui/index.html` populates the method select from that manifest only; the inline fallback list is removed
- `bridge.ts` gains `selectableMethods(manifest): string[]` (manifest order, no duplicates) and keeps `methodsFromManifest`/`groupByKind`
- `packages/desktop/test/parity.test.ts` asserts every capability the core manifest exposes is selectable in the UI path, i.e. `selectableMethods(listCapabilities())` equals the manifest names

Validate Rust with `cargo check` and `cargo fmt --check` inside `packages/desktop/src-tauri`; report both.
