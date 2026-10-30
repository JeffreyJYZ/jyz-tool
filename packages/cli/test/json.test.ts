import { expect, test } from "bun:test";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BIN = join(import.meta.dir, "..", "src", "bin.ts");

async function runJyz(cwd: string, args: string[]) {
	const proc = Bun.spawn([process.execPath, BIN, ...args], {
		cwd,
		env: process.env,
		stdout: "pipe",
		stderr: "pipe",
	});
	const timer = setTimeout(() => proc.kill(), 20000);
	const [stdout, stderr, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	clearTimeout(timer);
	return { code, stdout, stderr };
}

test("config show --json parses", async () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-json-"));
	try {
		writeFileSync(join(dir, "jyz.config.toml"), '[project]\npackage_manager = "bun"\n', "utf8");
		const r = await runJyz(dir, ["config", "show", "--json"]);
		expect(r.code).toBe(0);
		const doc = JSON.parse(r.stdout);
		expect(doc.project.package_manager.value).toBe("bun");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("failure emits json error doc", async () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-json-"));
	try {
		const r = await runJyz(dir, ["config", "get", "nope", "--json"]);
		expect(r.code).toBe(1);
		const doc = JSON.parse(r.stdout);
		expect(typeof doc.error).toBe("string");
		expect(doc.exitCode).toBe(1);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
