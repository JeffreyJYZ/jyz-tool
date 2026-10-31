import { $ } from "bun";

/** Poll one expression until it is truthy, so a deferred module script has time to run. */
export async function waitUntil(
	session: string,
	expression: string,
	timeoutMs = 10_000,
): Promise<void> {
	const deadline = Date.now() + timeoutMs;
	while (Date.now() < deadline) {
		const value = await browser(session, ["eval", expression]);
		if (value.trim() === "true") return;
		await Bun.sleep(150);
	}
	throw new Error(`timed out waiting for: ${expression}`);
}

/** Run one `agent-browser` subcommand and return its stdout. */
export async function browser(session: string, words: string[]): Promise<string> {
	const result = await $`agent-browser ${words}`
		.env({ ...process.env, AGENT_BROWSER_SESSION: session })
		.quiet()
		.nothrow();
	if (result.exitCode !== 0) {
		throw new Error(`agent-browser ${words.join(" ")}: ${result.stderr.toString().trim()}`);
	}
	return result.stdout.toString().trim();
}

/** JSON out of one `eval`, which the CLI prints as a JSON string or a bare value. */
export function evalJson(text: string): unknown {
	try {
		return JSON.parse(text);
	} catch {
		return text;
	}
}
