// Entry point for the stdio MCP server: the wire loop in `stdio.ts` bound to
// the real process streams.
//
// `startServer` is exported so a test or a host wrapper can drive the same
// wiring; the module only starts itself when run directly.

import { serve } from "./stdio.ts";

export async function startServer(cwd: string = process.cwd()): Promise<void> {
	const reader = Bun.stdin.stream().getReader();
	const decoder = new TextDecoder();
	try {
		await serve(
			{
				read: async () => {
					const { value, done } = await reader.read();
					if (done || value === undefined) return null;
					return decoder.decode(value, { stream: true });
				},
				write: async (chunk) => {
					await Bun.write(Bun.stdout, chunk);
				},
			},
			{ cwd },
		);
	} finally {
		reader.releaseLock();
	}
}

if (import.meta.main) {
	await startServer();
}
