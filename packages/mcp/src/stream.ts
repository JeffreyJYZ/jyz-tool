import type { CommandSpec, ProjectContext } from "@jyz/core";
import { resolveProject } from "@jyz/core";
import { ToolInputError } from "./errors.ts";
import type { CallOptions, ProgressFrame, StreamStart } from "./types.ts";

interface ActiveStream {
	handle: string;
	proc: ReturnType<typeof spawnPiped>;
	argv: string[];
	emit: (frame: Omit<ProgressFrame, "handle">) => void;
	detach: () => void;
}

const streams = new Map<string, ActiveStream>();
let handleSeq = 0;

function nextHandle(): string {
	handleSeq += 1;
	return `watch-${handleSeq}-${Math.random().toString(36).slice(2, 8)}`;
}

function messageOf(err: unknown): string {
	return err instanceof Error ? err.message : String(err);
}

function normalizeTarget(target?: string | CallOptions): CallOptions {
	if (target === undefined) return { cwd: process.cwd() };
	if (typeof target === "string") return { cwd: target };
	if (target.cwd === undefined) return { ...target, cwd: process.cwd() };
	return target;
}

function spawnPiped(spec: CommandSpec) {
	return Bun.spawn({
		cmd: [spec.file, ...spec.argv],
		cwd: spec.cwd,
		env: process.env,
		stdin: "ignore",
		stdout: "pipe",
		stderr: "pipe",
		detached: true,
	});
}

async function pump(
	stream: ReadableStream<Uint8Array>,
	emit: (data: string) => void,
): Promise<void> {
	const reader = stream.getReader();
	const decoder = new TextDecoder();
	try {
		for (;;) {
			const { value, done } = await reader.read();
			if (done) break;
			if (value === undefined) continue;
			const text = decoder.decode(value, { stream: true });
			if (text !== "") emit(text);
		}
		const tail = decoder.decode();
		if (tail !== "") emit(tail);
	} finally {
		reader.releaseLock();
	}
}

function resolveCtx(cwd: string, filter?: string): ProjectContext {
	return filter === undefined ? resolveProject(cwd) : resolveProject(cwd, { filter });
}

export function startWatch(
	input: Record<string, unknown>,
	options: CallOptions,
	dispatchSpec: (
		ctx: ProjectContext,
		verb: string,
		input: Record<string, unknown>,
	) => CommandSpec,
	strArray: (v: unknown) => string[],
): StreamStart {
	const script = typeof input.script === "string" ? input.script : "";
	if (script === "") throw new ToolInputError("jyz_watch", "a script name is required");
	const cwd = options.cwd ?? process.cwd();
	const ctx = resolveCtx(cwd, typeof input.filter === "string" ? input.filter : undefined);
	const spec = dispatchSpec(ctx, "run", { args: [script, ...strArray(input.args)] });
	const requested = typeof input.handle === "string" ? input.handle : "";
	const handle = requested !== "" ? requested : nextHandle();
	if (streams.has(handle)) {
		throw new ToolInputError("jyz_watch", `handle "${handle}" is already streaming`);
	}

	const proc = spawnPiped(spec);
	const emit = (frame: Omit<ProgressFrame, "handle">): void => {
		try {
			options.onProgress?.({ handle, ...frame });
		} catch {
			// A host callback must never break the pump that feeds it.
		}
	};

	const entry: ActiveStream = { handle, proc, argv: spec.argv, emit, detach: () => {} };
	streams.set(handle, entry);

	const signal = options.signal;
	if (signal !== undefined) {
		const onAbort = (): void => {
			void stopStream(entry);
		};
		if (signal.aborted) onAbort();
		else signal.addEventListener("abort", onAbort, { once: true });
		entry.detach = () => signal.removeEventListener("abort", onAbort);
	}

	emit({ type: "start", data: spec.argv.join(" ") });
	void finishWhenExited(entry);
	return { handle, streaming: true, argv: spec.argv, packageDir: ctx.packageDir };
}

async function finishWhenExited(entry: ActiveStream): Promise<void> {
	const proc = entry.proc;
	try {
		await Promise.all([
			pump(proc.stdout as ReadableStream<Uint8Array>, (data) =>
				entry.emit({ type: "stdout", data }),
			),
			pump(proc.stderr as ReadableStream<Uint8Array>, (data) =>
				entry.emit({ type: "stderr", data }),
			),
			proc.exited,
		]);
	} catch (err) {
		if (proc.exitCode === null && proc.signalCode === null) {
			entry.emit({ type: "error", data: messageOf(err) });
		}
	}
	const exitCode = proc.exitCode ?? (proc.signalCode === null ? 1 : 0);
	entry.emit({ type: "exit", data: String(exitCode), exitCode });
	entry.detach();
	streams.delete(entry.handle);
}

function signalTree(proc: ReturnType<typeof spawnPiped>, signal: NodeJS.Signals): void {
	try {
		if (process.platform === "win32") proc.kill(signal);
		else process.kill(-proc.pid, signal);
	} catch {
		try {
			proc.kill(signal);
		} catch {
			// Already gone.
		}
	}
}

async function settledWithin(promise: Promise<unknown>, ms: number): Promise<boolean> {
	let timer: ReturnType<typeof setTimeout> | undefined;
	const timeout = new Promise<boolean>((resolve) => {
		timer = setTimeout(() => resolve(false), ms);
	});
	try {
		return await Promise.race([promise.then(() => true), timeout]);
	} finally {
		if (timer !== undefined) clearTimeout(timer);
	}
}

export async function stopStream(entry: ActiveStream): Promise<boolean> {
	entry.emit({ type: "cancelled", data: `cancel requested for ${entry.handle}` });
	const proc = entry.proc;
	if (proc.exitCode !== null || proc.signalCode !== null) return true;
	signalTree(proc, "SIGTERM");
	if (await settledWithin(proc.exited, 1500)) return true;
	signalTree(proc, "SIGKILL");
	return settledWithin(proc.exited, 1500);
}

export async function cancelAllStreams(): Promise<void> {
	await Promise.all([...streams.values()].map((entry) => stopStream(entry)));
}

export function getStream(handle: string): ActiveStream | undefined {
	return streams.get(handle);
}

export { normalizeTarget };
