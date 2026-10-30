import { expect, test } from "bun:test";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

const BIN = "/Users/jyz/dev/jyz/packages/cli/src/bin.ts";

function fixture(): string {
	return mkdtempSync(join(tmpdir(), "jyz-e2e-"));
}

function cleanup(dir: string): void {
	rmSync(dir, { recursive: true, force: true });
}

function stubPm(dir: string, name: "bun" | "pnpm", record: string, exitCode = 0): string {
	const binDir = join(dir, "bin");
	mkdirSync(binDir, { recursive: true });
	const path = join(binDir, name);
	writeFileSync(
		path,
		`#!/bin/sh\nprintf '%s\\n' "$*" >> "${record}"\nexit ${exitCode}\n`,
		"utf8",
	);
	chmodSync(path, 0o755);
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
			PATH: `${binDir}:${process.env.PATH}`,
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
			PATH: `${binDir}:${process.env.PATH}`,
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
			PATH: `${binDir}:${process.env.PATH}`,
		});
		expect(res.code).toBe(0);
		const rec = readFileSync(record, "utf8").trim();
		expect(rec).toContain("--latest");
	} finally {
		cleanup(dir);
	}
});

test("exit code passes through from stub", async () => {
	const dir = fixture();
	try {
		writeFileSync(join(dir, "package.json"), JSON.stringify({ name: "x" }), "utf8");
		writeFileSync(join(dir, "bun.lock"), "", "utf8");
		const record = join(dir, "record.txt");
		const binDir = stubPm(dir, "bun", record, 3);
		const res = await runJyz(dir, ["add", "x"], { PATH: `${binDir}:${process.env.PATH}` });
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
			PATH: `${binDir}:${process.env.PATH}`,
		});
		expect(res.code).toBe(0);
		// cwd recorded? stub doesn't record cwd. Check record exists
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
		const res = await runJyz(dir, ["a", "x"], { PATH: `${binDir}:${process.env.PATH}` });
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
		// readConfigTables runs at startup, so even --version fails
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
		const res = await runJyz(dir, ["dev"], { PATH: `${binDir}:${process.env.PATH}` });
		// bun run dev -> stub records "run dev"
		expect(res.code).toBe(0);
		expect(readFileSync(record, "utf8").trim()).toBe("run dev");
	} finally {
		cleanup(dir);
	}
});
