import { readLine } from "./read-line";
import {
	cancelStep,
	initializeStep,
	resourcesListStep,
	resourcesReadStep,
	toolsCallConfigStep,
	toolsListStep,
	watchStep,
} from "./steps";
import type { SmokeStep } from "./types";
import { TIMEOUT_MS } from "./types";

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
		try {
			proc.kill();
		} catch {
			// Already gone.
		}
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
		const init = await initializeStep(send);
		steps.push(init);
		if (!init.ok) return steps;

		const tl = await toolsListStep(send);
		steps.push(tl.step);
		if (!tl.step.ok) return steps;

		const tc = await toolsCallConfigStep(send);
		steps.push(tc);
		if (!tc.ok) return steps;

		const rl = await resourcesListStep(send);
		steps.push(rl);
		if (!rl.ok) return steps;

		const rr = await resourcesReadStep(send);
		steps.push(rr);
		if (!rr.ok) return steps;

		const ws = await watchStep(send);
		steps.push(ws.step);
		if (!ws.step.ok) return steps;

		const cs = await cancelStep(send, ws.handle);
		steps.push(cs);
		return steps;
	} finally {
		finalize();
		try {
			await proc.exited;
		} catch {
			// ignore
		}
	}
}
