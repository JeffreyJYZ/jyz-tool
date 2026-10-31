import { expect, test } from "bun:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { writeStub } from "../../../core/test/helpers/stub.ts";

const BIN = join(import.meta.dir, "..", "..", "src", "bin.ts");

function fixture(): string {
	return mkdtempSync(join(tmpdir(), "jyz-e2e-"));
}

function cleanup(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}

function stubPm(dir: string, name: "bun" | "pnpm", record: string, exitCode = 0): string {
	const binDir = join(dir, "bin");
	writeStub(binDir, name, { record, exitCode, format: "simple" });
	return binDir;
}

async function runJyz(
	cwd: string,
	args: string[],
	env: Record<string, string> = {},
	timeout = 20000,
): Promise<{ code: number; stdout: string; stderr: string }> {
	const proc = Bun.spawn([process.execPath, BIN, ...args], {
		cwd,
		env: { ...process.env, ...env },
		stdout: "pipe",
		stderr: "pipe",
	});
	const timer = setTimeout(() => proc.kill(), timeout);
	const [stdout, stderr, code] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
		proc.exited,
	]);
	clearTimeout(timer);
	return { code, stdout, stderr };
}

test("config set keeps comments; check --strict exits 1 on unknown key", async () => {
	const dir = fixture();
	try {
		writeFileSync(
			join(dir, "jyz.config.toml"),
			'# keep me\n[project]\npackage_manager = "bun"\nfoo = "bar"\n',
			"utf8",
		);
		const set = await runJyz(dir, ["config", "set", "project.formatter", "biome"]);
		expect(set.code).toBe(0);
		const text = readFileSync(join(dir, "jyz.config.toml"), "utf8");
		expect(text).toContain("# keep me");
		const check = await runJyz(dir, ["config", "check", "--strict"]);
		expect(check.code).toBe(1);
	} finally {
		cleanup(dir);
	}
});

test("dispatch bun records transformed argv", async () => {
	const dir = fixture();
	try {
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
		writeFileSync(join(dir, "bun.lock"), "", "utf8");
		const record = join(dir, "record.txt");
		const binDir = stubPm(dir, "bun", record);
		const res = await runJyz(dir, ["add", "-D", "x"], {
			PATH: `${binDir}${delimiter}${process.env.PATH}`,
		});
		expect(res.code).toBe(0);
		const rec = readFileSync(record, "utf8").trim();
		expect(rec).toBe("add -d x");
	} finally {
		cleanup(dir);
	}
});

test("dispatch pnpm records argv verbatim", async () => {
	const dir = fixture();
	try {
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
		writeFileSync(join(dir, "pnpm-lock.yaml"), "", "utf8");
		const record = join(dir, "record.txt");
		const binDir = stubPm(dir, "pnpm", record);
		const res = await runJyz(dir, ["add", "-D", "x"], {
			PATH: `${binDir}${delimiter}${process.env.PATH}`,
		});
		expect(res.code).toBe(0);
		const rec = readFileSync(record, "utf8").trim();
		expect(rec).toBe("add -D x");
	} finally {
		cleanup(dir);
	}
});

test("update --latest records --latest", async () => {
	const dir = fixture();
	try {
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
		writeFileSync(join(dir, "bun.lock"), "", "utf8");
		const record = join(dir, "record.txt");
		const binDir = stubPm(dir, "bun", record);
		const res = await runJyz(dir, ["update", "--latest"], {
			PATH: `${binDir}${delimiter}${process.env.PATH}`,
		});
		expect(res.code).toBe(0);
		const rec = readFileSync(record, "utf8").trim();
		expect(rec).toContain("--latest");
	} finally {
		cleanup(dir);
	}
});
