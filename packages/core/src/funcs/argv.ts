import type { ArgvRequest } from "../types/command.ts";
import type { PackageManager } from "../types/config.ts";

export function buildArgv(pm: PackageManager, req: ArgvRequest): string[] {
	const args = req.args;
	switch (req.verb) {
		case "install":
			return ["install", ...args];
		case "add":
			return ["add", ...(req.dev ? [pm === "bun" ? "-d" : "-D"] : []), ...args];
		case "remove":
			return ["remove", ...args];
		case "run":
			return ["run", ...args];
		case "exec":
			return pm === "bun" ? ["bunx", ...args] : ["exec", ...args];
		case "update":
			return ["update", ...(req.latest ? ["--latest"] : []), ...args];
		case "outdated":
			return ["outdated", ...args];
	}
}
