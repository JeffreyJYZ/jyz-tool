import { readdirSync } from "node:fs";
import path from "node:path";
import { jyzArgv } from "./jyz-bin";
import type { CheckResult } from "./scaffold-checks";

type Recorder = (step: string, r: CheckResult | { ok: boolean; detail: string }) => void;

/**
 * The `rust-lib` template was declared in the `Template` type with no directory behind it, so
 * `jyz create --template rust-lib` answered "not available in this build". This scenario keeps it
 * honest: scaffold it, then let cargo compile and test the layout it wrote.
 */
export async function runRustLibScenario(dir: string, record: Recorder): Promise<void> {
	const scaffold = await runCmd(
		jyzArgv(["create", "rustlib", "--template", "rust-lib", "--yes"]),
		dir,
		120_000,
	);
	record("rust-lib:scaffold", scaffold);
	if (!scaffold.ok) return;

	const found = readdirSync(dir).find((entry) => entry.startsWith("rustlib"));
	if (!found) {
		record("rust-lib:project-dir", { ok: false, detail: "no rustlib directory was created" });
		return;
	}
	const projectDir = path.join(dir, found);

	const check = await runCmd(["cargo", "check", "--quiet"], projectDir, 300_000);
	record("rust-lib:cargo-check", check);
	if (!check.ok) return;

	const test = await runCmd(["cargo", "test", "--quiet"], projectDir, 300_000);
	record("rust-lib:cargo-test", {
		ok: test.ok,
		detail: test.ok ? "cargo test passed" : test.detail,
	});
}

async function runCmd(cmd: string[], cwd: string, timeoutMs: number) {
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
	if (killed) return { ok: false, detail: `timeout after ${timeoutMs}ms`, stdout };
	if (code !== 0) {
		const tail = (stderr || stdout).trim().split("\n").slice(-5).join(" | ");
		return { ok: false, detail: `exit ${code}: ${tail}`, stdout };
	}
	return { ok: true, detail: "ok", stdout };
}
