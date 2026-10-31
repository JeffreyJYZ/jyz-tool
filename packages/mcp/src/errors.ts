export class UnknownToolError extends Error {
	readonly validNames: string[];
	constructor(name: string, validNames: string[]) {
		super(`unknown tool "${name}"; valid tools: ${validNames.join(", ")}`);
		this.name = "UnknownToolError";
		this.validNames = validNames;
	}
}

export class ToolInputError extends Error {
	readonly tool: string;
	constructor(tool: string, message: string) {
		super(`${tool}: ${message}`);
		this.name = "ToolInputError";
		this.tool = tool;
	}
}

export class UnknownHandleError extends Error {
	readonly handle: string;
	constructor(handle: string) {
		super(`unknown streaming handle "${handle}"`);
		this.name = "UnknownHandleError";
		this.handle = handle;
	}
}
