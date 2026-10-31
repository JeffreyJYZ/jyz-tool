import { readdirSync } from "node:fs";
import path from "node:path";
import type { CheckResult } from "./scaffold-checks";

type Recorder = (step: string, r: CheckResult | { ok: boolean; detail: string }) => void;

/**
 * The C template is the one layout the plan still calls untested against a real compiler: it ships
 * a Makefile and a justfile, but nothing ever built them. This scenario scaffolds it, builds with
 * the host C compiler, runs the binary and checks the greeting carries the project name.
 */
export async function runCScenario(dir: string, record: Recorder): Promise<void> {
	const scaffold = await runCmd(
		["jyz", "create", "capp", "--template", "c", "--yes"],
		dir,
		120_000,
	);
	record("c:scaffold", scaffold);
	if (!scaffold.ok) return;

	const found = readdirSync(dir).find((entry) => entry.startsWith("capp"));
	if (!found) {
		record("c:project-dir", { ok: false, detail: "no capp directory was created" });
		return;
	}
	const projectDir = path.join(dir, found);

	// `make check` is the compiler-only gate the template ships; it proves the sources parse with
	// the flags the Makefile declares, without needing a linker.
	const check = await runCmd(["make", "check"], projectDir, 120_000);
	record("c:make-check", check);
	if (!check.ok) return;

	const build = await runCmd(["make", "build"], projectDir, 120_000);
	record("c:make-build", build);
	if (!build.ok) return;

	const bin = path.join(projectDir, "dist", "capp");
	const run = await runCmd([bin], projectDir, 30_000);
	record("c:run", {
		ok: run.ok && run.stdout.includes("capp"),
		detail: run.ok ? run.stdout.trim().slice(0, 80) : run.detail,
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
