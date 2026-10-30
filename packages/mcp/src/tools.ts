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

const stringArray = {
	type: "array",
	items: { type: "string" },
};

const baseProps = {
	args: stringArray,
	dev: { type: "boolean" },
	latest: { type: "boolean" },
	filter: { type: "string" },
};

export function listTools(): ToolDefinition[] {
	return [
		{
			name: "jyz_install",
			description: "Install project dependencies.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps },
				additionalProperties: false,
			},
			destructive: true,
		},
		{
			name: "jyz_add",
			description: "Add a dependency.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps, dev: { type: "boolean" } },
				additionalProperties: false,
			},
			destructive: true,
		},
		{
			name: "jyz_remove",
			description: "Remove a dependency.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps },
				additionalProperties: false,
			},
			destructive: true,
		},
		{
			name: "jyz_run",
			description: "Run a package script.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps },
				additionalProperties: false,
			},
			destructive: true,
		},
		{
			name: "jyz_exec",
			description: "Execute a binary.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps },
				additionalProperties: false,
			},
			destructive: true,
		},
		{
			name: "jyz_update",
			description: "Update dependencies.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps, latest: { type: "boolean" } },
				additionalProperties: false,
			},
			destructive: true,
		},
		{
			name: "jyz_outdated",
			description: "List outdated dependencies.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps },
				additionalProperties: false,
			},
			destructive: false,
		},
		{
			name: "jyz_create",
			description: "Scaffold a new project.",
			inputSchema: {
				type: "object",
				properties: {
					name: { type: "string" },
					template: { type: "string" },
					dir: { type: "string" },
					packageManager: { type: "string" },
					typechecker: { type: "string" },
					linter: { type: "string" },
					formatter: { type: "string" },
					docs: { type: "boolean" },
					git: { type: "string" },
					install: { type: "boolean" },
					publishable: { type: "boolean" },
					yes: { type: "boolean" },
				},
				required: ["name"],
				additionalProperties: false,
			},
			destructive: true,
		},
		{
			name: "jyz_config",
			description: "Read or write jyz.config.toml.",
			inputSchema: {
				type: "object",
				properties: {
					action: { type: "string", enum: ["show", "get", "set", "check"] },
					key: { type: "string" },
					value: { type: "string" },
					strict: { type: "boolean" },
				},
				additionalProperties: false,
			},
			destructive: false,
		},
		{
			name: "jyz_typecheck",
			description: "Run the configured typechecker.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps },
				additionalProperties: false,
			},
			destructive: false,
		},
		{
			name: "jyz_lint",
			description: "Run the configured linter.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps },
				additionalProperties: false,
			},
			destructive: false,
		},
		{
			name: "jyz_check",
			description: "Run typecheck and lint.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps },
				additionalProperties: false,
			},
			destructive: false,
		},
		{
			name: "jyz_fmt",
			description: "Format the project.",
			inputSchema: {
				type: "object",
				properties: { ...baseProps, check: { type: "boolean" } },
				additionalProperties: false,
			},
			destructive: true,
		},
		{
			name: "jyz_watch",
			description:
				"Run a package script and stream its stdout and stderr as progress frames.",
			inputSchema: {
				type: "object",
				properties: {
					script: { type: "string" },
					args: stringArray,
					filter: { type: "string" },
					handle: { type: "string" },
				},
				required: ["script"],
				additionalProperties: false,
			},
			destructive: true,
			streaming: true,
			handle: "handle",
		},
		{
			name: "jyz_cancel",
			description: "Stop a streaming tool by its handle.",
			inputSchema: {
				type: "object",
				properties: { handle: { type: "string" } },
				required: ["handle"],
				additionalProperties: false,
			},
			destructive: false,
			streaming: true,
			handle: "handle",
		},
	];
}

/** Every tool that returns a handle and reports progress instead of a final result. */
export function listStreamingTools(): ToolDefinition[] {
	return listTools().filter((tool) => tool.streaming === true);
}

/** The input property carrying a streaming handle, or `null` for a non-streaming tool. */
export function handleFieldOf(tool: ToolDefinition): string | null {
	return tool.streaming === true ? (tool.handle ?? null) : null;
}
