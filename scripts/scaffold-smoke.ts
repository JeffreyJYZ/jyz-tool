#!/usr/bin/env bun

import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import type { CheckResult } from "./smoke/scaffold-checks";
import { checkConfig, checkUpdaterRs } from "./smoke/scaffold-checks";

interface Step {
	step: string;
	ok: boolean;
	detail: string;
}

const results: Step[] = [];

function record(step: string, r: CheckResult | { ok: boolean; detail: string }): void {
	results.push({ step, ok: r.ok, detail: r.detail });
}

async function runCmd(
	cmd: string[],
	cwd: string,
	timeoutMs: number,
): Promise<{ ok: boolean; detail: string }> {
	const proc = Bun.spawn({ cmd, cwd, stdout: "pipe", stderr: "pipe" });
	let killed = false;
	const timer = setTimeout(() => {
		killed = true;
		try {
			proc.kill();
		} catch {
			// ignore
		}
	}, timeoutMs);
	const [stdout, stderr] = await Promise.all([
		new Response(proc.stdout).text(),
		new Response(proc.stderr).text(),
	]);
	const code = await proc.exited;
	clearTimeout(timer);
	if (killed) {
		return { ok: false, detail: `timeout after ${timeoutMs}ms` };
	}
	if (code !== 0) {
		const tail = (stderr || stdout).trim().split("\n").slice(-5).join(" | ");
		return { ok: false, detail: `exit ${code}: ${tail}` };
	}
	return { ok: true, detail: "ok" };
}

async function main(): Promise<void> {
	const args = Bun.argv.slice(2);
	const json = args.includes("--json");
	const skipCargo = args.includes("--skip-cargo");

	const dir = mkdtempSync(path.join(tmpdir(), "jyz-scaffold-"));
	let projectDir = "";
	try {
		// Step 1: scaffold
		const scaffold = await runCmd(
			[
				"jyz",
				"create",
				"smokeapp",
				"--template",
				"vite-tauri",
				"--feature",
				"updater",
				"--yes",
			],
			dir,
			120_000,
		);
		if (scaffold.ok) {
			// find created dir
			const fs = await import("node:fs");
			const entries = fs.readdirSync(dir);
			const found = entries.find((e) => e.startsWith("smokeapp"));
			projectDir = found ? path.join(dir, found) : path.join(dir, "smokeapp");
		}
		record("scaffold", scaffold);

		if (!scaffold.ok) {
			finish(json);
			return;
		}

		// Step 2: cargo check
		if (!skipCargo) {
			const cargo = await runCmd(
				["cargo", "check"],
				path.join(projectDir, "src-tauri"),
				300_000,
			);
			record("cargo-check", cargo);
			if (!cargo.ok) {
				finish(json);
				return;
			}
		} else {
			record("cargo-check", { ok: true, detail: "skipped" });
		}

		// Step 3: updater.rs
		const fs = await import("node:fs");
		const updaterPath = path.join(projectDir, "src-tauri", "src", "updater.rs");
		let updaterText = "";
		try {
			updaterText = fs.readFileSync(updaterPath, "utf8");
		} catch (e) {
			record("updater-rs", { ok: false, detail: String(e) });
			finish(json);
			return;
		}
		record("updater-rs", checkUpdaterRs(updaterText));

		// Step 4: config
		const confPath = path.join(projectDir, "src-tauri", "tauri.conf.json");
		let conf: unknown = null;
		try {
			conf = JSON.parse(fs.readFileSync(confPath, "utf8"));
		} catch (e) {
			record("config", { ok: false, detail: String(e) });
			finish(json);
			return;
		}
		record("config", checkConfig(conf));
	} finally {
		try {
			rmSync(dir, { recursive: true, force: true });
		} catch {
			// ignore
		}
	}
	finish(json);
}

function finish(json: boolean): void {
	if (json) {
		console.log(JSON.stringify(results));
	} else {
		for (const s of results) {
			console.log(`${s.ok ? "ok" : "FAIL"} ${s.step} ${s.detail}`);
		}
	}
	const allOk = results.length > 0 && results.every((s) => s.ok);
	process.exit(allOk ? 0 : 1);
}

if (import.meta.main) {
	await main();
}
