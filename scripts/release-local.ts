#!/usr/bin/env bun
export * from "./release/helpers";

import { main } from "./release/run";

if (import.meta.main) {
	main().catch((error) => {
		console.error(error instanceof Error ? error.message : String(error));
		process.exit(1);
	});
}
