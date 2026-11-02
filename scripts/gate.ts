/**
 * The gate: everything CI runs, in one command, before every push.
 *
 * CI is the authority — this script mirrors it so a red run is found here rather
 * than three minutes later on three platforms. It runs every step even after a
 * failure and reports the whole list, because "which of the eight broke" is the
 * question a gate exists to answer.
 *
 * Skipped on purpose: the Rust job (cargo builds only on a matching host, and the
 * bundle is CI's), and the desktop browser gates (they install agent-browser and
 * drive a real browser; `--browser` opts in on a Mac).
 *
 * Usage: bun run gate [--browser] [--quick]
 */
import { $ } from "bun";

const flags = new Set(Bun.argv.slice(2));
const browser = flags.has("--browser");
const quick = flags.has("--quick");

interface Step {
	name: string;
	run: () => Promise<number>;
}

const shell = (command: string, cwd?: string) => async (): Promise<number> => {
	const dir = cwd ? { cwd } : {};
	const result = await $`${{ raw: command }}`
		.env(process.env)
		.nothrow()
		.quiet()
		.cwd(cwd ?? process.cwd());
	if (result.exitCode !== 0) {
		const output = `${result.stdout.toString()}${result.stderr.toString()}`.trim();
		if (output) console.error(output.split("\n").slice(-25).join("\n"));
	}
	return result.exitCode;
};

const steps: Step[] = [
	{ name: "root: install", run: shell("bun install --frozen-lockfile") },
	{ name: "root: typecheck", run: shell("bun run typecheck") },
	{ name: "root: lint", run: shell("bun run lint") },
	{ name: "root: size", run: shell("bun run size") },
	{ name: "root: format:check", run: shell("bun run format:check") },
	{ name: "root: test", run: shell("bun run test") },
	{ name: "root: jyz --version", run: shell("bun run jyz --version") },
];

if (!quick) {
	steps.push(
		{ name: "website: install", run: shell("bun install --frozen-lockfile", "website") },
		{ name: "website: check", run: shell("bun run check", "website") },
		{ name: "website: build", run: shell("bun run build", "website") },
	);
	if (process.platform !== "win32") {
		steps.push({
			name: "templates: C scenario",
			run: shell("bun scripts/scaffold-smoke.ts --scenario=c"),
		});
	}
	steps.push(
		{ name: "packages: cli tarball", run: shell("bun scripts/cli-pack.ts") },
		{ name: "packages: mcp tarball", run: shell("bun scripts/mcp-pack.ts") },
	);
}

if (browser) {
	steps.push(
		{ name: "desktop: build web", run: shell("bun run --cwd packages/desktop build:web") },
		{ name: "desktop: walkthrough", run: shell("bun scripts/ui-walkthrough.ts") },
		{ name: "desktop: a11y", run: shell("bun run a11y") },
	);
}

const failed: string[] = [];
for (const step of steps) {
	process.stdout.write(`${step.name} … `);
	const code = await step.run();
	if (code === 0) {
		console.log("ok");
		continue;
	}
	console.log(`FAILED (${code})`);
	failed.push(step.name);
}

if (failed.length > 0) {
	console.error(`\n${failed.length} of ${steps.length} steps failed:\n- ${failed.join("\n- ")}`);
	process.exit(1);
}
console.log(`\nall ${steps.length} steps passed`);
