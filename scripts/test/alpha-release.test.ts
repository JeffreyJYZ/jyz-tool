import { expect, test } from "bun:test";
import { existsSync } from "node:fs";
import { nextAlpha, manifestFiles } from "../alpha-release";

test("nextAlpha bumps", () => {
	expect(nextAlpha("0.1.0-alpha.1")).toBe("0.1.0-alpha.2");
});

test("nextAlpha throws on non-alpha", () => {
	expect(() => nextAlpha("1.2.3")).toThrow();
});

test("nextAlpha alpha.9 -> alpha.10", () => {
	expect(nextAlpha("0.1.0-alpha.9")).toBe("0.1.0-alpha.10");
});

test("manifestFiles returns every version-bearing path", () => {
	const files = manifestFiles();
	expect(files).toHaveLength(7);
	expect(files).toContain("packages/desktop/src-tauri/Cargo.toml");
	for (const f of files) expect(existsSync(f)).toBe(true);
});

test("--dry-run prints without touching", async () => {
	const proc = Bun.spawnSync(["bun", "scripts/alpha-release.ts", "--dry-run"], {
		stdout: "pipe",
	});
	expect(proc.exitCode).toBe(0);
	expect(proc.stdout.toString()).toContain("would release");
});
