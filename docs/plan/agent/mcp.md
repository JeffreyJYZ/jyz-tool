---
updated: 202610301411
version: 1.1
---

# MCP Server (v2)

## Purpose

Let agents drive jyz directly. One MCP server, one tool per core capability, no shelling out to the CLI.

Because core is TypeScript on Bun, the server imports the core API in-process. It does not spawn `jyz`, does not parse human output, and cannot drift from the CLI's behaviour.

## Tools

Mirror the v1 command surface, in core terms rather than argv terms:

| Tool | Underlying operation |
| --- | --- |
| `jyz_install` | install |
| `jyz_add` | add, with `dev: true` for dev dependencies |
| `jyz_remove` | remove |
| `jyz_run` | run a script |
| `jyz_exec` | execute a binary |
| `jyz_update` | update |
| `jyz_outdated` | outdated |
| `jyz_create` | create, all template and git flags exposed as arguments |
| `jyz_config` | show, get, set, check |
| `jyz_typecheck` | typecheck |
| `jyz_lint` | lint |
| `jyz_check` | check |
| `jyz_fmt` | fmt |

Each tool returns structured data, not scraped text: exit code, resolved package, resolved package manager, argv, and captured stdout/stderr.

Long-running verbs (a watch-mode script, a dev server) get streaming tools: the call returns immediately with a handle, progress and output arrive as notifications, and a paired cancel tool stops the child. Streaming is opt-in per tool rather than applied to everything.

## Rules

- Tools resolve everything through core, so a monorepo filter means the same thing here as in the CLI.
- Destructive or network operations (`create --git github`, `update`, `add`) are annotated as such so a host can require confirmation.
- A resource exposes the merged config plus its source layers, which is what an agent needs before acting.
- Errors carry the detection result, so a host learns why a toolchain was chosen rather than only that a command failed.
- Absolute paths only in responses; no relative paths that depend on the server's cwd.

## Distribution

Two artefacts ship together in v2:

- an npm package with a `bin` entry, for hosts that already have a runtime
- compiled standalone binaries per platform, for hosts without Node or Bun

Both are produced from the same source in the same release, and the verify step asserts that every artefact answers a tool list and one real call.

## Acceptance gate

- every core capability appears as a tool, checked against the same manifest the desktop gate uses
- a behavioural test asserts the MCP tool and the CLI produce the same resolved argv for the same fixture
- a streaming test: start a long child, receive at least one progress notification, cancel it, confirm the child exited
- both distributions installed and smoke-tested on all three platforms

## Resolved

- Streaming: yes, opt-in streaming tools plus cancel for long verbs.
- Distribution: npm package with `bin` and standalone binaries, both in v2.
