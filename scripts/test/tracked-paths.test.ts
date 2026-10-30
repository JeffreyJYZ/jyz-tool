import { expect, test } from "bun:test";

/**
 * A path carrying a newline, quote or shell redirect marker cannot be checked out on Windows,
 * and it comes from a botched heredoc in an agent shell rather than from any real file. The gate
 * belongs here because CI never reaches its own steps: checkout fails first.
 *
 * The listing must run from the repo toplevel: `git ls-files` run from a subdirectory lists only
 * that subdirectory, which is exactly how a junk name elsewhere slipped through once.
 */
test("no tracked path carries control characters or shell redirect markers", () => {
	const root = Bun.spawnSync(["git", "rev-parse", "--show-toplevel"]);
	const toplevel = root.stdout.toString().trim();
	expect(toplevel).not.toBe("");

	const listed = Bun.spawnSync(["git", "ls-files", "-z"], { cwd: toplevel });
	const names = listed.stdout.toString().split("\0").filter(Boolean);
	expect(names.length).toBeGreaterThan(20);

	const offenders = names.filter((name) => /[\n\r"'<>|\\]/.test(name));
	expect(offenders).toEqual([]);
});
