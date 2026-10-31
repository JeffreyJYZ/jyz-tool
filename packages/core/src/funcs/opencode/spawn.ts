import { resolveCommand, spawnArgv } from "../which.ts";
import type { SpawnedServer, SpawnServerOptions } from "./shared.ts";
import { OpencodeSpawnError, resolveServer } from "./shared.ts";

const SPAWN_TIMEOUT_MS = 5000;

const spawnedPids = new Set<number>();
const spawnedProcs = new Map<number, ReturnType<typeof Bun.spawn>>();

function resolveSpawnUrl(env: Record<string, string | undefined> = process.env): string {
	const resolved = resolveServer({ env });
	return resolved.baseUrl;
}

async function waitForReady(baseUrl: string, proc: ReturnType<typeof Bun.spawn>): Promise<void> {
	const deadline = Date.now() + SPAWN_TIMEOUT_MS;
	while (Date.now() < deadline) {
		if (proc.exitCode !== null) {
			let stderr = "";
			try {
				if (
					proc.stderr &&
					typeof (proc.stderr as ReadableStream).getReader === "function"
				) {
					stderr = await new Response(proc.stderr as ReadableStream).text();
				}
			} catch {
				// ignore
			}
			throw new OpencodeSpawnError(
				`opencode exited before ready: ${stderr.trim() || `exit ${proc.exitCode}`}`,
				baseUrl,
			);
		}
		try {
			const response = await fetch(`${baseUrl}/`, { signal: AbortSignal.timeout(200) });
			void response;
			return;
		} catch {
			await new Promise((resolve) => setTimeout(resolve, 50));
		}
	}
	throw new OpencodeSpawnError(`timed out waiting for opencode at ${baseUrl}`, baseUrl);
}

export async function spawnServer(opts: SpawnServerOptions): Promise<SpawnedServer> {
	const command = opts.command ?? "opencode";
	const baseUrl = resolveSpawnUrl();
	const parts = resolveCommand(command)
		.trim()
		.split(/\s+/)
		.filter((part) => part !== "");
	if (parts.length === 0) {
		throw new OpencodeSpawnError("empty opencode command", baseUrl);
	}
	const proc = Bun.spawn({
		cmd: spawnArgv(parts[0] ?? "", parts.slice(1)),
		cwd: opts.cwd,
		env: process.env,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
	});
	const pid = proc.pid;
	let stopped = false;
	const stop = async (): Promise<void> => {
		if (stopped) return;
		stopped = true;
		if (!spawnedPids.has(pid)) return;
		spawnedPids.delete(pid);
		spawnedProcs.delete(pid);
		try {
			proc.kill();
		} catch {
			// ignore
		}
		try {
			await proc.exited;
		} catch {
			// ignore
		}
	};
	try {
		await waitForReady(baseUrl, proc);
	} catch (error) {
		try {
			proc.kill();
		} catch {
			// ignore
		}
		throw error;
	}
	spawnedPids.add(pid);
	spawnedProcs.set(pid, proc);
	return { pid, baseUrl, stop };
}

export function spawnedServers(): number[] {
	return [...spawnedPids];
}

export function killSpawned(pid: number): void {
	const proc = spawnedProcs.get(pid);
	if (proc === undefined) return;
	spawnedPids.delete(pid);
	spawnedProcs.delete(pid);
	try {
		proc.kill();
	} catch {
		// ignore
	}
}
