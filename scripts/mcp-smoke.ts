#!/usr/bin/env bun

export interface SmokeStep {
	step: string;
	ok: boolean;
	detail: string;
}

const TIMEOUT_MS = 15000;

function killProc(proc: ReturnType<typeof Bun.spawn>): void {
	try {
		proc.kill();
	} catch {
		// Already gone.
	}
}

type ByteReader = { read(): Promise<{ done: boolean; value?: Uint8Array }> };

async function readLine(
	reader: ByteReader,
	decoder: TextDecoder,
	state: { buffer: string },
	deadline: number,
): Promise<string | null> {
	while (!state.buffer.includes("\n")) {
		if (Date.now() >= deadline) return null;
		const remaining = deadline - Date.now();
		let timer: ReturnType<typeof setTimeout> | undefined;
		const timeoutPromise = new Promise<{ value: undefined; done: true }>((resolve) => {
			timer = setTimeout(() => resolve({ value: undefined, done: true }), remaining);
		});
		const readPromise = reader.read().then((r) => {
			if (timer !== undefined) clearTimeout(timer);
			return r;
		});
		const result = await Promise.race([readPromise, timeoutPromise]);
		if (timer !== undefined) clearTimeout(timer);
		if (result.done) {
			if (state.buffer.trim() !== "") {
				const line = state.buffer;
				state.buffer = "";
				return line;
			}
			return null;
		}
		if (result.value !== undefined) {
			state.buffer += decoder.decode(result.value, { stream: true });
		}
	}
	const idx = state.buffer.indexOf("\n");
	const line = state.buffer.slice(0, idx);
	state.buffer = state.buffer.slice(idx + 1);
	return line;
}

export async function runSmoke(cmd: string[], cwd: string): Promise<SmokeStep[]> {
	const steps: SmokeStep[] = [];
	const proc = Bun.spawn({
		cmd,
		cwd,
		stdin: "pipe",
		stdout: "pipe",
		stderr: "ignore",
	});
	const writer = proc.stdin as { write: (chunk: string) => number; end: () => void };
	const reader = (proc.stdout as ReadableStream<Uint8Array>).getReader();
	const decoder = new TextDecoder();
	const state = { buffer: "" };
	const deadline = Date.now() + TIMEOUT_MS;

	const send = async (method: string, params: unknown, id: number): Promise<unknown> => {
		const frame = { jsonrpc: "2.0", id, method, params };
		writer.write(`${JSON.stringify(frame)}\n`);
		const line = await readLine(reader, decoder, state, deadline);
		if (line === null) throw new Error("no response (timeout or EOF)");
		let parsed: unknown;
		try {
			parsed = JSON.parse(line);
		} catch {
			throw new Error(`malformed frame: ${line.slice(0, 80)}`);
		}
		if (typeof parsed !== "object" || parsed === null || Array.isArray(parsed)) {
			throw new Error("malformed frame: not an object");
		}
		const obj = parsed as Record<string, unknown>;
		if (obj.jsonrpc !== "2.0") throw new Error("malformed frame: bad jsonrpc");
		if (obj.id !== id) throw new Error(`malformed frame: id mismatch (got ${String(obj.id)})`);
		if (obj.error !== undefined) {
			const err = obj.error as { message?: string };
			throw new Error(`rpc error: ${err?.message ?? "unknown"}`);
		}
		return obj.result;
	};

	const finalize = (): void => {
		killProc(proc);
		try {
			reader.releaseLock();
		} catch {
			// ignore
		}
		try {
			writer.end();
		} catch {
			// ignore
		}
	};

	try {
		// 1. initialize
		try {
			const result = (await send(
				"initialize",
				{
					protocolVersion: "2025-06-18",
					capabilities: {},
					clientInfo: { name: "mcp-smoke", version: "0" },
				},
				1,
			)) as Record<string, unknown> | null;
			if (!result || typeof result.protocolVersion !== "string")
				throw new Error("missing protocolVersion");
			steps.push({ step: "initialize", ok: true, detail: String(result.protocolVersion) });
		} catch (err) {
			steps.push({
				step: "initialize",
				ok: false,
				detail: err instanceof Error ? err.message : String(err),
			});
			return steps;
		}

		// 2. tools/list
		let toolCount = 0;
		try {
			const result = (await send("tools/list", {}, 2)) as Record<string, unknown> | null;
			const tools = (result?.tools ?? []) as unknown[];
			if (!Array.isArray(tools)) throw new Error("tools not an array");
			toolCount = tools.length;
			steps.push({ step: "tools/list", ok: true, detail: `${toolCount} tools` });
		} catch (err) {
			steps.push({
				step: "tools/list",
				ok: false,
				detail: err instanceof Error ? err.message : String(err),
			});
			return steps;
		}

		// 3. tools/call jyz_config action path
		try {
			const result = (await send(
				"tools/call",
				{ name: "jyz_config", arguments: { action: "path" } },
				3,
			)) as Record<string, unknown> | null;
			const content = (result?.content ?? []) as unknown[];
			if (!Array.isArray(content) || content.length === 0) throw new Error("missing content");
			steps.push({ step: "tools/call", ok: true, detail: `${content.length} content` });
		} catch (err) {
			steps.push({
				step: "tools/call",
				ok: false,
				detail: err instanceof Error ? err.message : String(err),
			});
			return steps;
		}

		// 4. resources/list
		let _hasCapabilities = false;
		try {
			const result = (await send("resources/list", {}, 4)) as Record<string, unknown> | null;
			const resources = (result?.resources ?? []) as { uri?: string }[];
			if (!Array.isArray(resources)) throw new Error("resources not an array");
			_hasCapabilities = resources.some((r) => r?.uri === "jyz://capabilities");
			steps.push({
				step: "resources/list",
				ok: true,
				detail: `${resources.length} resources`,
			});
		} catch (err) {
			steps.push({
				step: "resources/list",
				ok: false,
				detail: err instanceof Error ? err.message : String(err),
			});
			return steps;
		}

		// 5. resources/read jyz://capabilities
		try {
			const result = (await send(
				"resources/read",
				{ uri: "jyz://capabilities" },
				5,
			)) as Record<string, unknown> | null;
			const contents = (result?.contents ?? []) as unknown[];
			if (!Array.isArray(contents) || contents.length === 0)
				throw new Error("missing contents");
			steps.push({ step: "resources/read", ok: true, detail: `${contents.length} contents` });
		} catch (err) {
			steps.push({
				step: "resources/read",
				ok: false,
				detail: err instanceof Error ? err.message : String(err),
			});
			return steps;
		}

		// 6. tools/call jyz_watch (streaming)
		let watchHandle = "";
		try {
			const result = (await send(
				"tools/call",
				{ name: "jyz_watch", arguments: { script: "lint" } },
				6,
			)) as Record<string, unknown> | null;
			const content = (result?.content ?? []) as { text?: string }[];
			if (!Array.isArray(content) || content.length === 0) throw new Error("missing content");
			const parsed = JSON.parse(content[0]?.text ?? "{}") as { handle?: string };
			if (typeof parsed.handle !== "string" || parsed.handle === "")
				throw new Error("missing handle");
			watchHandle = parsed.handle;
			steps.push({ step: "tools/call", ok: true, detail: `handle ${watchHandle}` });
		} catch (err) {
			steps.push({
				step: "tools/call",
				ok: false,
				detail: err instanceof Error ? err.message : String(err),
			});
			return steps;
		}

		// 7. tools/call jyz_cancel
		try {
			const result = (await send(
				"tools/call",
				{ name: "jyz_cancel", arguments: { handle: watchHandle } },
				7,
			)) as Record<string, unknown> | null;
			const content = (result?.content ?? []) as { text?: string }[];
			if (!Array.isArray(content) || content.length === 0) throw new Error("missing content");
			const parsed = JSON.parse(content[0]?.text ?? "{}") as { cancelled?: boolean };
			if (parsed.cancelled !== true) throw new Error("cancel did not succeed");
			steps.push({ step: "tools/call", ok: true, detail: "cancelled" });
		} catch (err) {
			steps.push({
				step: "tools/call",
				ok: false,
				detail: err instanceof Error ? err.message : String(err),
			});
			return steps;
		}

		return steps;
	} finally {
		finalize();
		// Ensure process exited
		try {
			await proc.exited;
		} catch {
			// ignore
		}
	}
}

async function main(): Promise<void> {
	const args = Bun.argv.slice(2);
	const json = args.includes("--json");
	const cmd = ["bun", "packages/mcp/src/server.ts"];
	const cwd = process.cwd();
	const steps = await runSmoke(cmd, cwd);
	if (json) {
		console.log(JSON.stringify(steps));
	} else {
		for (const s of steps) {
			console.log(`${s.ok ? "ok" : "FAIL"} ${s.step} ${s.detail}`);
		}
	}
	const allOk = steps.length === 7 && steps.every((s) => s.ok);
	process.exit(allOk ? 0 : 1);
}

if (import.meta.main) {
	await main();
}
