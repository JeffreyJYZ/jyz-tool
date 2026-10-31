export interface ToolDefinition {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	destructive: boolean;
	/** True when the call returns a handle at once and reports progress through `onProgress`. */
	streaming?: boolean;
	/** Name of the input property that carries the streaming handle, when `streaming` is set. */
	handle?: string;
}

import { listTools } from "./tools-list.ts";

export { listTools } from "./tools-list.ts";

export function listStreamingTools() {
	return listTools().filter((tool) => tool.streaming === true);
}

export function handleFieldOf(tool: ToolDefinition): string | null {
	return tool.streaming === true ? (tool.handle ?? null) : null;
}
