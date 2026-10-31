import { dirname, join } from "node:path";
import type { CommandSpec } from "../types/command.ts";
import type { PackageManager } from "../types/config.ts";
import { resolveCommand } from "./which.ts";

/**
 * The names a `.bin` entry can carry on this platform. On Windows an extensionless file is not
 * executable, so a shim is `foo.cmd`, `foo.exe` or `foo.ps1`; elsewhere the name is the file.
 */
function candidates(bin: string): string[] {
	if (process.platform !== "win32") return [bin];
	const extensions = (process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
		.split(";")
		.filter(Boolean)
		.map((extension) => extension.toLowerCase());
	return [bin, ...extensions.map((extension) => `${bin}${extension}`)];
}

export function resolveExecutable(pm: PackageManager, dir: string, bin: string): string {
	let current = dir;
	while (true) {
		const binDir = join(current, "node_modules", ".bin");
		for (const name of candidates(bin)) {
			const candidate = join(binDir, name);
			try {
				if (Bun.file(candidate).size > 0) return candidate;
			} catch {
				// ignore
			}
		}
		const parent = dirname(current);
		// A Windows drive root is its own parent, so compare and stop rather than loop.
		if (parent === current || parent === "") break;
		current = parent;
	}
	return pm === "bun" ? "bunx" : "pnpm";
}
export async function runCommand(
	spec: CommandSpec,
	opts?: { stdio?: "inherit" | "pipe"; signal?: AbortSignal },
): Promise<{ exitCode: number; stdout: string; stderr: string }> {
	const stdio = opts?.stdio ?? "inherit";
	const pipe = stdio === "pipe";

	const proc = Bun.spawn({
		cmd: [resolveCommand(spec.file), ...spec.argv],
		cwd: spec.cwd,
		env: process.env,
		stdin: "inherit",
		stdout: pipe ? "pipe" : "inherit",
		stderr: pipe ? "pipe" : "inherit",
		signal: opts?.signal,
	});

	const onSigint = () => {
		try {
			proc.kill("SIGINT");
		} catch {
			// ignore
		}
	};
	const onSigterm = () => {
		try {
			proc.kill("SIGTERM");
		} catch {
			// ignore
		}
	};
	process.on("SIGINT", onSigint);
	process.on("SIGTERM", onSigterm);

	const exitCode = await proc.exited;

	process.off("SIGINT", onSigint);
	process.off("SIGTERM", onSigterm);

	let stdout = "";
	let stderr = "";
	if (pipe) {
		stdout = await new Response(proc.stdout as ReadableStream).text();
		stderr = await new Response(proc.stderr as ReadableStream).text();
	}
	return { exitCode, stdout, stderr };
}
