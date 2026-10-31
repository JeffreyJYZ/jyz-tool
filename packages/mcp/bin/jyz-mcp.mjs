#!/usr/bin/env bun
// A checkout runs the TypeScript entry so edits apply with no build; a packed install has no src/
// and falls through to the bundle, which already carries @jyz/core.
import { existsSync } from "node:fs";

const src = new URL("../src/bin.ts", import.meta.url);
const dist = new URL("../dist/bin.js", import.meta.url);
await import(existsSync(src) ? src.href : dist.href);
