import type { CommandSpec } from "../types/command.ts";
import type { PackageManager } from "../types/config.ts";

export function resolveExecutable(pm: PackageManager, dir: string, bin: string): string {
	let current = dir;
	while (true) {
		const candidate = `${current}/node_modules/.bin/${bin}`;
		try {
			const file = Bun.file(candidate);
			if (file.size > 0) return candidate;
		} catch {
			// ignore
		}
		const parent = current.replace(/\/[^/]+$/, "");
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
		cmd: [spec.file, ...spec.argv],
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
