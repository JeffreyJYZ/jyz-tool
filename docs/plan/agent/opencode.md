---
updated: 202610301411
version: 1.1
---

# opencode Integration (v2)

## Purpose

Start, watch and drive opencode sessions from jyz, using the client packages opencode already ships rather than reimplementing its protocol.

## Shape

- Client comes from the opencode SDK package. At v2 start, check the current release, pin it exactly and record the pinned version in `packages/core`; bump on purpose, never through a floating range.
- Attach is the default: jyz talks to a server already running on the machine, and treats it as read-only unless a flag says otherwise.
- Spawning is opt-in: `--spawn` starts a server jyz owns, records its PID and state path, and cleans up only what it started.
- Session work goes through core, so the CLI and the desktop panel share one implementation, and the MCP server can expose the same operations.

## v2 surface

| Capability                  | CLI                                 | Desktop              |
| --------------------------- | ----------------------------------- | -------------------- |
| list sessions for a project | `jyz oc sessions`                   | session list         |
| start a session             | `jyz oc start [--spawn] [--prompt]` | new session button   |
| send a prompt               | `jyz oc prompt <text>`              | composer             |
| watch status and output     | `jyz oc watch`                      | live view            |
| open the TUI for a session  | `jyz oc attach`                     | open terminal button |

## Rules

- jyz never restarts or kills a server it did not spawn.
- An attached server is read-only by default; writes require an explicit flag and say so in the output.
- A spawned server's PID and credentials path are recorded, so a later run can attach or clean up without guessing.
- Permission decisions are surfaced, never auto-approved.
- A version mismatch between the pinned client and the running server is reported with both versions, not worked around.

## Acceptance gate

- session listing and prompt round-trip against a locally spawned server in CI on macOS and Linux
- the attach path tested against a server jyz did not start
- a test asserting jyz never kills a server it did not spawn
- a pinned-version test that fails when the recorded SDK version and the resolved dependency disagree

## Resolved

- Lifecycle: attach by default, spawn opt-in.
- SDK version: check the current release at v2 start, pin it exactly, record it.
