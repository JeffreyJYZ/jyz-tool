import { existsSync, statSync } from "node:fs";
import { delimiter, isAbsolute, join } from "node:path";

/**
 * Find a command on PATH the way the shell would.
 *
 * A bare name is not enough on Windows: an extensionless file is not executable there, and the
 * command lives in `foo.cmd`, `foo.exe` or `foo.bat` per PATHEXT. Spawning `foo` then fails with
 * "Executable not found in $PATH" even though the shim sits on PATH. Resolving to the absolute path
 * here makes both platforms behave the same, and it is what the test stubs rely on.
 */
export function which(
	name: string,
	pathEnv: string | undefined = process.env.PATH,
	platform: string = process.platform,
): string | null {
	if (name === "") return null;
	if (isAbsolute(name) || name.includes("/") || name.includes("\\")) {
		return existsSync(name) ? name : null;
	}
	const extensions =
		platform === "win32"
			? [""].concat(
					(process.env.PATHEXT ?? ".COM;.EXE;.BAT;.CMD")
						.split(";")
						.filter(Boolean)
						.map((extension) => extension.toLowerCase()),
				)
			: [""];
	for (const dir of (pathEnv ?? "").split(delimiter)) {
		if (dir === "") continue;
		for (const extension of extensions) {
			const candidate = join(dir, `${name}${extension}`);
			try {
				if (statSync(candidate).size > 0) return candidate;
			} catch {
				// not here; keep looking
			}
		}
	}
	return null;
}

/** The same command, resolved when possible and left alone when not, so errors stay meaningful. */
export function resolveCommand(name: string): string {
	return which(name) ?? name;
}

/** A `.cmd`/`.bat` shim is a batch script, not an executable: Windows runs it through cmd.exe. */
export function spawnArgv(
	file: string,
	argv: string[],
	platform: string = process.platform,
): string[] {
	if (platform === "win32" && /\.(cmd|bat)$/i.test(file)) {
		return [process.env.COMSPEC ?? "cmd.exe", "/c", file, ...argv];
	}
	return [file, ...argv];
}
