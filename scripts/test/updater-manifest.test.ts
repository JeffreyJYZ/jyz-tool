import { describe, expect, test } from "bun:test";

import {
	assetUrl,
	manifestProblems,
	mergeManifests,
	partialManifest,
	partialNames,
	platformKey,
	type UpdaterManifest,
} from "../updater-manifest";

function manifest(overrides: Partial<UpdaterManifest> = {}): UpdaterManifest {
	return {
		version: "0.1.0",
		pub_date: "2026-10-31T00:00:00Z",
		platforms: {
			"darwin-aarch64": {
				signature: "sig-1",
				url: "https://example.test/jyz.app.tar.gz",
			},
			"linux-x86_64": {
				signature: "sig-2",
				url: "https://example.test/jyz_0.1.0_amd64.AppImage.tar.gz",
			},
		},
		...overrides,
	};
}

describe("platformKey", () => {
	test("maps the three hosts Tauri names", () => {
		expect(platformKey("darwin", "arm64")).toBe("darwin-aarch64");
		expect(platformKey("darwin", "x64")).toBe("darwin-x64");
		expect(platformKey("linux", "x64")).toBe("linux-x86_64");
		expect(platformKey("win32", "x64")).toBe("windows-x86_64");
	});

	test("keeps an unknown arch verbatim instead of inventing one", () => {
		expect(platformKey("linux", "riscv64")).toBe("linux-riscv64");
	});
});

describe("assetUrl", () => {
	test("names the tag and encodes the asset", () => {
		expect(assetUrl("v0.1.0-alpha.11", "jyz.app.tar.gz")).toBe(
			"https://github.com/JeffreyJYZ/jyz-tool/releases/download/v0.1.0-alpha.11/jyz.app.tar.gz",
		);
	});
});

describe("partialManifest", () => {
	test("carries the signature as written and the asset url", () => {
		const partial = partialManifest({
			version: "0.1.0-alpha.11",
			platform: "darwin-aarch64",
			signature: "  sig-blob\n",
			asset: "jyz.app.tar.gz",
			tag: "v0.1.0-alpha.11",
			pubDate: "2026-10-31T01:00:00Z",
		});
		expect(partial.version).toBe("0.1.0-alpha.11");
		expect(partial.platforms["darwin-aarch64"]?.signature).toBe("sig-blob");
		expect(partial.platforms["darwin-aarch64"]?.url).toContain("v0.1.0-alpha.11");
		expect(partial.pub_date).toBe("2026-10-31T01:00:00Z");
	});

	test("omits pub_date when it is not given", () => {
		const partial = partialManifest({
			version: "0.1.0-alpha.11",
			platform: "darwin-aarch64",
			signature: "sig",
			asset: "jyz.app.tar.gz",
			tag: "v0.1.0-alpha.11",
		});
		expect("pub_date" in partial).toBe(false);
	});
});

describe("mergeManifests", () => {
	test("unions the platforms of every partial", () => {
		const mac = manifest({ platforms: { "darwin-aarch64": { signature: "s1", url: "u1" } } });
		const linux = manifest({ platforms: { "linux-x86_64": { signature: "s2", url: "u2" } } });
		const win = manifest({ platforms: { "windows-x86_64": { signature: "s3", url: "u3" } } });
		const merged = mergeManifests([mac, linux, win], "0.1.0-alpha.11");
		expect(Object.keys(merged.platforms).sort()).toEqual([
			"darwin-aarch64",
			"linux-x86_64",
			"windows-x86_64",
		]);
		expect(merged.version).toBe("0.1.0-alpha.11");
	});

	test("stamps the version from the release, not from the partial", () => {
		expect(mergeManifests([manifest()], "0.1.0-alpha.11").version).toBe("0.1.0-alpha.11");
	});

	test("an empty input is an empty platform map, not a crash", () => {
		expect(mergeManifests([], "0.1.0-alpha.11").platforms).toEqual({});
	});
});

describe("manifestProblems", () => {
	test("a complete manifest has no problems", () => {
		expect(manifestProblems(mergeManifests([manifest()], "0.1.0-alpha.11"))).toEqual([]);
	});

	test("an empty platform map is reported", () => {
		expect(manifestProblems(manifest({ platforms: {} }))).toContain(
			"latest.json lists no platforms",
		);
	});

	test("a blank signature and a blank url are both named", () => {
		const problems = manifestProblems(
			manifest({ platforms: { "darwin-aarch64": { signature: " ", url: "" } } }),
		);
		expect(problems).toContain("darwin-aarch64: empty signature");
		expect(problems).toContain("darwin-aarch64: empty url");
	});

	test("a blank version is reported", () => {
		expect(manifestProblems(manifest({ version: "  " }))).toContain(
			"latest.json has no version",
		);
	});
});

describe("partialNames", () => {
	test("picks the per-platform partials and ignores the final manifest", () => {
		expect(
			partialNames(["latest-darwin-aarch64.json", "latest.json", "jyz.app.tar.gz"]),
		).toEqual(["latest-darwin-aarch64.json"]);
	});

	test("sorts so a merged report is stable", () => {
		expect(partialNames(["latest-windows-x86_64.json", "latest-darwin-aarch64.json"])).toEqual([
			"latest-darwin-aarch64.json",
			"latest-windows-x86_64.json",
		]);
	});

	test("no partials means no work", () => {
		expect(partialNames(["latest.json", "cli-0.1.0-darwin-arm64"])).toEqual([]);
	});
});
