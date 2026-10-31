import { join } from "node:path";

/**
 * A argv prefix that runs the CLI from this checkout.
 *
 * `jyz` is only on PATH when `bun link` has been run, which is true on a developer machine and
 * false on CI. Calling the entry point directly keeps the smoke scenarios honest on both.
 */
export function jyzArgv(args: string[]): string[] {
	return [
		process.execPath,
		join(import.meta.dir, "..", "..", "packages", "cli", "src", "bin.ts"),
		...args,
	];
}
