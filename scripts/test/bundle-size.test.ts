import { expect, test } from "bun:test";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { recordSizes } from "../bundle-size.ts";

function fixture(): { dir: string; table: string; release: string } {
	const dir = mkdtempSync(join(tmpdir(), "jyz-sizes-"));
	const release = join(dir, "release");
	mkdirSync(release, { recursive: true });
	writeFileSync(join(release, "desktop-0.1.0-alpha.1-darwin-arm64.dmg"), Buffer.alloc(2_000_000));
	writeFileSync(join(release, "jyz.app.tar.gz"), Buffer.alloc(1_000_000));
	writeFileSync(join(release, "cli-0.1.0-alpha.1-darwin-arm64"), Buffer.alloc(500_000));
	writeFileSync(join(release, "mcp-0.1.0-alpha.1-darwin-arm64"), Buffer.alloc(400_000));
	// The package must not shadow the binary column.
	writeFileSync(join(release, "mcp-0.1.0-alpha.1.tgz"), Buffer.alloc(10_000));
	return { dir, table: join(dir, "sizes.md"), release };
}

test("a row records megabytes for each artefact", () => {
	const { dir, table, release } = fixture();
	try {
		const row = recordSizes("0.1.0-alpha.1", { releaseDir: release, table });
		expect(row).toBe("| 0.1.0-alpha.1 | 2.0 | 1.0 | 0.5 | 0.4 |");
		expect(readFileSync(table, "utf8")).toContain(row);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("recording the same version twice keeps one row", () => {
	const { dir, table, release } = fixture();
	try {
		recordSizes("0.1.0-alpha.1", { releaseDir: release, table });
		recordSizes("0.1.0-alpha.1", { releaseDir: release, table });
		const lines = readFileSync(table, "utf8")
			.split("\n")
			.filter((line) => line.includes("| 0.1.0-alpha.1 |"));
		expect(lines).toHaveLength(1);
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});

test("a missing artefact is an em dash, never a crash", () => {
	const dir = mkdtempSync(join(tmpdir(), "jyz-sizes-"));
	try {
		const release = join(dir, "empty");
		mkdirSync(release, { recursive: true });
		const row = recordSizes("0.1.0-alpha.2", {
			releaseDir: release,
			table: join(dir, "sizes.md"),
		});
		expect(row).toBe("| 0.1.0-alpha.2 | — | — | — | — |");
	} finally {
		rmSync(dir, { recursive: true, force: true });
	}
});
