import { expect, test } from "bun:test";

/**
 * A path carrying a newline, quote or shell redirect marker cannot be checked out on Windows,
 * and it comes from a botched heredoc in an agent shell rather than from any real file. The gate
 * belongs here because CI never reaches its own steps: checkout fails first.
 */
test("no tracked path carries control characters or shell redirect markers", () => {
	const listed = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: import.meta.dir });
	const names = listed.stdout.toString().split("\0").filter(Boolean);
	const offenders = names.filter((name) => /[\n\r"'<>|\\]/.test(name));
	expect(offenders).toEqual([]);
});
