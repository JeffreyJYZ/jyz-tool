import { expect, test } from "bun:test";
import { mkdtempSync, rmSync } from "node:fs";
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
	const timer = setTimeout(() => proc.kill(), 30000);
	const [stdout, stderr, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	clearTimeout(timer);
	return { code, stdout, stderr };
}

test("list-features prints and creates nothing", async () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-cf-"));
	try {
		const r = await runJyz(dir, ["create", "--list-features"]);
		expect(r.code).toBe(0);
		expect(r.stdout).toContain("updater");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("feature applied to cli template", async () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-cf-"));
	try {
		const r = await runJyz(dir, [
			"create",
			"demo",
			"--template",
			"cli",
			"--feature",
			"cac-cli",
			"--yes",
			"--json",
		]);
		expect(r.code).toBe(0);
		const doc = JSON.parse(r.stdout);
		expect(doc.features).toContain("cac-cli");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("unknown feature fails non-zero", async () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-cf-"));
	try {
		const r = await runJyz(dir, [
			"create",
			"demo",
			"--template",
			"cli",
			"--feature",
			"nope",
			"--yes",
		]);
		expect(r.code).not.toBe(0);
		expect(r.stderr + r.stdout).toContain("nope");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("template mismatch fails non-zero", async () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-cf-"));
	try {
		const r = await runJyz(dir, [
			"create",
			"demo",
			"--template",
			"cli",
			"--feature",
			"updater",
			"--yes",
		]);
		expect(r.code).not.toBe(0);
		expect(r.stderr + r.stdout).toContain("updater");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("merged features dedup", async () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-cf-"));
	try {
		const r = await runJyz(dir, [
			"create",
			"demo",
			"--template",
			"cli",
			"--feature",
			"cac-cli",
			"--features",
			"cac-cli",
			"--yes",
			"--json",
		]);
		expect(r.code).toBe(0);
		const doc = JSON.parse(r.stdout);
		expect(doc.features).toEqual(["cac-cli"]);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
