# @jyz/desktop

Placeholder for the Tauri 2 shell. Not built yet: the plan puts it at v2, after the CLI reaches M4.

Spec: [../../docs/plan/agent/desktop.md](../../docs/plan/agent/desktop.md).

Constraints already settled:

- the installer ships the CLI as well, so the app is a wrapper over the CLI, not a second implementation
- the window talks to the CLI over its JSON-RPC stdio surface
- every core capability must be reachable from the UI, checked against the capability manifest

Nothing here runs yet, and no dependency is declared for it. That is deliberate: an empty package that builds nothing cannot lie about being finished.
