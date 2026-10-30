## Task 42 — the window says an update is available

Owns: `packages/desktop/ui/index.html`, `packages/desktop/src/updates.ts`, `packages/desktop/test/updates.test.ts`.

- `src/updates.ts` exports `describeUpdate(offer: { current: string; version: string; notes: string | null } | null): { headline: string; detail: string } | null` (`null` when there is nothing to offer), and `updateCheckFailed(error: unknown): string` for the one-line failure message.
- The page calls `invoke("jyz_update_check")` once after the version footer resolves. When an offer comes back, a banner above the tab strip says `update available: <version>` with an **Install** button; pressing it calls `invoke("jyz_update_install")`, disables the button, and shows `installing… the app will restart`. A failed check renders nothing (never a red banner on a machine without a release endpoint). Keep the page framework-free, one `<script>`, dark theme, existing CSS vocabulary.
- Degrade cleanly when `__TAURI_INTERNALS__` is absent: no banner, no error.

Tests: `describeUpdate` for an offer, for null, and with a null `notes`; `updateCheckFailed` for an `Error` and for a string; tabs still map from the hash.
