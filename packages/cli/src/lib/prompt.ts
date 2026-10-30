/**
 * Asks one yes/no question when jyz is attached to a terminal.
 *
 * A non-interactive run (CI, a pipe, a test) proceeds without asking: refusing there would make the
 * command unusable, and `--yes` exists to skip this prompt explicitly.
 */
export async function confirm(question: string): Promise<boolean> {
	if (!process.stdin.isTTY) return true;
	const { createInterface } = await import("node:readline/promises");
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	try {
		const answer = await rl.question(`${question} [Y/n] `);
		return !/^n/i.test(answer.trim());
	} finally {
		rl.close();
	}
}
