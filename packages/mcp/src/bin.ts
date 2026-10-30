#!/usr/bin/env bun

// Thin entry for the stdio MCP server. The JSON-RPC loop lives in
// `server.ts`/`stdio.ts`; this file only resolves the working directory and
// hands it off.

import { startServer } from "./server.ts";

function resolveCwd(argv: readonly string[]): string {
	let cwd = process.env.JYZ_MCP_CWD;
	const idx = argv.indexOf("--cwd");
	if (idx !== -1 && idx + 1 < argv.length) {
		cwd = argv[idx + 1];
	}
	return cwd && cwd.trim() !== "" ? cwd : process.cwd();
}

const cwd = resolveCwd(process.argv.slice(2));
await startServer(cwd);
