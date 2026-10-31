import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
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

test("exit code passes through from stub", async () => {
	const dir = fixture();
	try {
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
		writeFileSync(join(dir, "bun.lock"), "", "utf8");
		const record = join(dir, "record.txt");
		const binDir = stubPm(dir, "bun", record, 3);
		const res = await runJyz(dir, ["add", "x"], {
			PATH: `${binDir}${delimiter}${process.env.PATH}`,
		});
		expect(res.code).toBe(3);
	} finally {
		cleanup(dir);
	}
});

test("-F acts on named member", async () => {
	const dir = fixture();
	try {
		mkdirSync(join(dir, "packages", "a"), { recursive: true });
		mkdirSync(join(dir, "packages", "b"), { recursive: true });
		writeFileSync(
			join(dir, "packages", "a", "package.json"),
			JSON.stringify({ name: "a" }),
			"utf8",
		);
		writeFileSync(
			join(dir, "packages", "b", "package.json"),
			JSON.stringify({ name: "b" }),
			"utf8",
		);
		writeFileSync(join(dir, "packages", "a", "bun.lock"), "", "utf8");
		writeFileSync(join(dir, "packages", "b", "bun.lock"), "", "utf8");
		const record = join(dir, "record.txt");
		const binDir = stubPm(dir, "bun", record);
		const res = await runJyz(dir, ["add", "x", "-F", "b"], {
			PATH: `${binDir}${delimiter}${process.env.PATH}`,
		});
		expect(res.code).toBe(0);
		expect(readFileSync(record, "utf8").trim()).toBe("add x");
	} finally {
		cleanup(dir);
	}
});

test("alias expansion makes jyz a x behave as add x", async () => {
	const dir = fixture();
	try {
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
		writeFileSync(join(dir, "bun.lock"), "", "utf8");
		writeFileSync(join(dir, "jyz.config.toml"), '[aliases]\na = "add"\n', "utf8");
		const record = join(dir, "record.txt");
		const binDir = stubPm(dir, "bun", record);
		const res = await runJyz(dir, ["a", "x"], {
			PATH: `${binDir}${delimiter}${process.env.PATH}`,
		});
		expect(res.code).toBe(0);
		expect(readFileSync(record, "utf8").trim()).toBe("add x");
	} finally {
		cleanup(dir);
	}
});

test("alias shadowing core verb exits non-zero naming alias", async () => {
	const dir = fixture();
	try {
		writeFileSync(join(dir, "jyz.config.toml"), '[aliases]\nadd = "x"\n', "utf8");
		const res = await runJyz(dir, ["--version"]);
		expect(res.code).not.toBe(0);
		expect(res.stderr + res.stdout).toContain("add");
	} finally {
		cleanup(dir);
	}
});

test("bare script runs package.json script", async () => {
	const dir = fixture();
	try {
		writeFileSync(
			join(dir, "package.json"),
			JSON.stringify({ name: "x", scripts: { dev: "echo hi" } }),
			"utf8",
		);
		writeFileSync(join(dir, "bun.lock"), "", "utf8");
		const record = join(dir, "record.txt");
		const binDir = stubPm(dir, "bun", record);
		const res = await runJyz(dir, ["dev"], {
			PATH: `${binDir}${delimiter}${process.env.PATH}`,
		});
		expect(res.code).toBe(0);
		expect(readFileSync(record, "utf8").trim()).toBe("run dev");
	} finally {
		cleanup(dir);
	}
});
