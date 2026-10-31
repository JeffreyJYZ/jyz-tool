import path from "node:path";
import { jyzArgv } from "./jyz-bin";
import type { CheckResult } from "./scaffold-checks";
import { checkCliBin, checkCliManifest } from "./scaffold-checks";

type Recorder = (step: string, r: CheckResult | { ok: boolean; detail: string }) => void;

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

export async function runCacCliScenario(dir: string, record: Recorder): Promise<void> {
	const scaffold = await runCmd(
		jyzArgv(["create", "smokeapp", "--template", "cli", "--feature", "cac-cli", "--yes"]),
		dir,
		120_000,
	);
	let projectDir = path.join(dir, "smokeapp");
	if (scaffold.ok) {
		const fs = await import("node:fs");
		const found = fs.readdirSync(dir).find((e) => e.startsWith("smokeapp"));
		projectDir = found ? path.join(dir, found) : projectDir;
	}
	record("cac-cli:scaffold", scaffold);
	if (!scaffold.ok) return;

	const install = await runCmd(["bun", "install"], projectDir, 180_000);
	record("cac-cli:bun-install", install);
	if (!install.ok) return;

	const outPath = path.join(dir, "out");
	const build = await runCmd(
		["bun", "build", "src/bin.ts", "--target=bun", "--outfile", outPath],
		projectDir,
		120_000,
	);
	record("cac-cli:bun-build", build);
	if (!build.ok) return;

	const run = await runCmd([outPath, "--version"], projectDir, 30_000);
	record("cac-cli:run-version", {
		ok: run.ok && run.stdout.includes("smokeapp") && run.stdout.includes("0.1.0"),
		detail: run.ok ? run.stdout.trim().slice(0, 80) : run.detail,
	});

	const fs = await import("node:fs");
	let manifest: unknown = null;
	try {
		manifest = JSON.parse(fs.readFileSync(path.join(projectDir, "package.json"), "utf8"));
	} catch (e) {
		record("cac-cli:package-json", { ok: false, detail: String(e) });
		return;
	}
	record("cac-cli:package-json", checkCliManifest(manifest));

	let binText = "";
	try {
		binText = fs.readFileSync(path.join(projectDir, "src", "bin.ts"), "utf8");
	} catch (e) {
		record("cac-cli:bin-module", { ok: false, detail: String(e) });
		return;
	}
	record("cac-cli:bin-module", checkCliBin(binText));
}
