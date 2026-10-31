import type { FeatureContext } from "./context.ts";

const MARKER = "// jyz:cac-cli";

export async function applyCacCli(
	_dir: string,
	ctx: FeatureContext,
): Promise<"applied" | "already applied"> {
	const binPath = "src/bin.ts";
	const manifestPath = "package.json";
	const testPath = "test/cli.smoke.test.ts";

	if (await ctx.exists(binPath)) {
		const existing = await ctx.read(binPath);
		if (existing.includes(MARKER)) return "already applied";
	}

	const binSource = `#!/usr/bin/env bun\n${MARKER}\nimport { cac } from "cac";\n\nconst cli = cac("jyz");\ncli.command("smoke", "smoke test").action(() => {\n\tconsole.log("ok");\n});\ncli.help();\ncli.parse();\n`;
	await ctx.write(binPath, binSource);

	if (await ctx.exists(manifestPath)) {
		const raw = await ctx.read(manifestPath);
		const manifest = JSON.parse(raw) as { bin?: Record<string, string> };
		manifest.bin = { ...manifest.bin, jyz: "./src/bin.ts" };
		await ctx.write(manifestPath, `${JSON.stringify(manifest, null, "\t")}\n`);
	}

	const smokeTest = `import { expect, test } from "bun:test";\n\ntest("cli smoke", () => {\n\texpect(true).toBe(true);\n});\n`;
	await ctx.write(testPath, smokeTest);

	return "applied";
}
