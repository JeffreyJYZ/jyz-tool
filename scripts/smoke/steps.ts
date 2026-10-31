import type { SmokeStep } from "./types";

type Send = (method: string, params: unknown, id: number) => Promise<unknown>;

export async function initializeStep(send: Send): Promise<SmokeStep> {
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
		return { step: "initialize", ok: true, detail: String(result.protocolVersion) };
	} catch (err) {
		return {
			step: "initialize",
			ok: false,
			detail: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function toolsListStep(send: Send): Promise<{ step: SmokeStep; count: number }> {
	try {
		const result = (await send("tools/list", {}, 2)) as Record<string, unknown> | null;
		const tools = (result?.tools ?? []) as unknown[];
		if (!Array.isArray(tools)) throw new Error("tools not an array");
		return {
			step: { step: "tools/list", ok: true, detail: `${tools.length} tools` },
			count: tools.length,
		};
	} catch (err) {
		return {
			step: {
				step: "tools/list",
				ok: false,
				detail: err instanceof Error ? err.message : String(err),
			},
			count: 0,
		};
	}
}

export async function toolsCallConfigStep(send: Send): Promise<SmokeStep> {
	try {
		const result = (await send(
			"tools/call",
			{ name: "jyz_config", arguments: { action: "path" } },
			3,
		)) as Record<string, unknown> | null;
		const content = (result?.content ?? []) as unknown[];
		if (!Array.isArray(content) || content.length === 0) throw new Error("missing content");
		return { step: "tools/call", ok: true, detail: `${content.length} content` };
	} catch (err) {
		return {
			step: "tools/call",
			ok: false,
			detail: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function resourcesListStep(send: Send): Promise<SmokeStep> {
	try {
		const result = (await send("resources/list", {}, 4)) as Record<string, unknown> | null;
		const resources = (result?.resources ?? []) as { uri?: string }[];
		if (!Array.isArray(resources)) throw new Error("resources not an array");
		return { step: "resources/list", ok: true, detail: `${resources.length} resources` };
	} catch (err) {
		return {
			step: "resources/list",
			ok: false,
			detail: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function resourcesReadStep(send: Send): Promise<SmokeStep> {
	try {
		const result = (await send("resources/read", { uri: "jyz://capabilities" }, 5)) as Record<
			string,
			unknown
		> | null;
		const contents = (result?.contents ?? []) as unknown[];
		if (!Array.isArray(contents) || contents.length === 0) throw new Error("missing contents");
		return { step: "resources/read", ok: true, detail: `${contents.length} contents` };
	} catch (err) {
		return {
			step: "resources/read",
			ok: false,
			detail: err instanceof Error ? err.message : String(err),
		};
	}
}

export async function watchStep(send: Send): Promise<{ step: SmokeStep; handle: string }> {
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
		return {
			step: { step: "tools/call", ok: true, detail: `handle ${parsed.handle}` },
			handle: parsed.handle,
		};
	} catch (err) {
		return {
			step: {
				step: "tools/call",
				ok: false,
				detail: err instanceof Error ? err.message : String(err),
			},
			handle: "",
		};
	}
}

export async function cancelStep(send: Send, watchHandle: string): Promise<SmokeStep> {
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
		return { step: "tools/call", ok: true, detail: "cancelled" };
	} catch (err) {
		return {
			step: "tools/call",
			ok: false,
			detail: err instanceof Error ? err.message : String(err),
		};
	}
}
