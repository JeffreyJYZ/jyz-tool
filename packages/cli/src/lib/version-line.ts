import { VERSION } from "@jyz/core";

/**
 * The one line `jyz --version` prints.
 *
 * cac's own `version()` appends `${platform}-${arch} bun-${process.version}`, and under Bun
 * `process.version` is the *Node compatibility* version (26.3.0 at the time of writing) rather than
 * Bun's own, which read as a bun nobody runs. This reports the runtime people can check.
 */
export function versionLine(runtimeVersion: string = Bun.version): string {
	return `jyz/${VERSION} ${process.platform}-${process.arch} bun-${runtimeVersion}`;
}
