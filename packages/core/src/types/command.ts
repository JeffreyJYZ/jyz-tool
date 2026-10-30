export type Verb = "install" | "add" | "remove" | "run" | "exec" | "update" | "outdated";

export interface ArgvRequest {
	verb: Verb;
	args: string[];
	dev?: boolean;
	latest?: boolean;
}

export interface CommandSpec {
	file: string;
	argv: string[];
	cwd: string;
}
