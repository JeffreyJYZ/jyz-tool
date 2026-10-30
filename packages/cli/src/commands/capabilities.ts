import { listCapabilities } from "@jyz/core";
import type { CAC } from "cac";
import { emit, isJson } from "../lib/output.ts";

/**
 * The capability manifest is the parity contract: the desktop window derives its method list from
 * it, and a test asserts the CLI reaches every entry. Printing it is what lets those two surfaces
 * agree without either importing the other's command table.
 */
export function registerCapabilities(cli: CAC): void {
	cli.command("capabilities", "print the capability manifest")
		.option("--json", "emit JSON")
		.action((options: { json?: boolean }) => {
			const capabilities = listCapabilities();
			if (options?.json === true || isJson()) {
				emit(capabilities);
				return;
			}
			for (const capability of capabilities) {
				const params =
					capability.params.length === 0 ? "" : ` ${capability.params.join(" ")}`;
				console.log(`${capability.name}\t${capability.kind}${params}`);
			}
		});
}
