#!/usr/bin/env bun
// A dev checkout runs the TypeScript entry, so edits apply with no build step. A packed install has
// no src/ — only the bundle — so the same shim falls through to dist/bin.js.
import { existsSync } from "node:fs";

const src = new URL("../src/bin.ts", import.meta.url);
const dist = new URL("../dist/bin.js", import.meta.url);
await import(existsSync(src) ? src.href : dist.href);
