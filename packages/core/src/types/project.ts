import type { ResolvedConfig } from "./config.ts";

export interface ProjectContext {
	root: string;
	packageDir: string;
	packageName: string;
	config: ResolvedConfig;
	warnings: string[];
}

export class ProjectError extends Error {
	code: "not_found" | "ambiguous" | "filter_no_match";
	candidates: string[];

	constructor(
		code: "not_found" | "ambiguous" | "filter_no_match",
		message: string,
		candidates: string[] = [],
	) {
		super(message);
		this.code = code;
		this.candidates = candidates;
	}
}
