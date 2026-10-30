import {
	ConfigError,
	ConfigWriteError,
	CreateError,
	ProjectError,
	ToolchainError,
} from "@jyz/core";
import { emit, isJson } from "./output.ts";
import { AliasError } from "./verbs.ts";

/** Prints one error the way jyz reports it and returns the exit code to use. */
export function reportError(error: unknown): number {
	if (error instanceof AliasError) {
		console.error(`jyz: ${error.message}`);
		return 1;
	}
	if (error instanceof ProjectError) {
		console.error(`jyz: ${error.message}`);
		for (const candidate of error.candidates) console.error(`  ${candidate}`);
		return 1;
	}
	if (
		error instanceof ConfigError ||
		error instanceof ConfigWriteError ||
		error instanceof CreateError ||
		error instanceof ToolchainError
	) {
		console.error(`jyz: ${error.message}`);
		return 1;
	}
	if (error instanceof Error) {
		console.error(`jyz: ${error.message}`);
		return 1;
	}
	console.error(`jyz: ${String(error)}`);
	return 1;
}

/** Runs an async command body, turning any throw into a printed error and a non-zero exit code. */
export async function guard(body: () => Promise<void> | void): Promise<void> {
	try {
		await body();
	} catch (error) {
		const code = reportError(error);
		if (isJson()) {
			const message = error instanceof Error ? error.message : String(error);
			emit({ error: message, exitCode: code });
		}
		process.exitCode = code;
	}
}
