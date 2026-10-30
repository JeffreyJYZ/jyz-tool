import { expect, test } from "bun:test";
import { runSmoke } from "../mcp-smoke";

test("real server: seven ok steps", async () => {
	const steps = await runSmoke(["bun", "packages/mcp/src/server.ts"], process.cwd());
	expect(steps).toHaveLength(7);
	for (const s of steps) expect(s.ok).toBe(true);
});

test("malformed frame yields one failed step", async () => {
	const steps = await runSmoke(
		["bun", "-e", "console.log('not-json'); await Bun.sleep(60000);"],
		process.cwd(),
	);
	expect(steps.length).toBe(1);
	expect(steps[0]?.ok).toBe(false);
});

test("step shape is stable", async () => {
	const steps = await runSmoke(["bun", "packages/mcp/src/server.ts"], process.cwd());
	for (const s of steps) {
		expect(typeof s.step).toBe("string");
		expect(typeof s.ok).toBe("boolean");
		expect(typeof s.detail).toBe("string");
	}
});
