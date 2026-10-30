export interface ToolDefinition {
	name: string;
	description: string;
	inputSchema: Record<string, unknown>;
	destructive: boolean;
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
	];
}
