/** The sessions the stub reports, so a step can assert the exact rows it expects. */
export const STUB_SESSIONS = [
	{ id: "ses_alpha", title: "v2 rollout", updatedAt: "2026-10-30T23:00:00Z" },
	{ id: "ses_beta", title: "release notes", updatedAt: "2026-10-30T22:10:00Z" },
];

/**
 * The IPC stub, as the JavaScript an init script runs before the page's own scripts.
 *
 * The manifest has three entries across three kinds so a broken grouping shows up as a missing
 * option rather than as a plausible list.
 */
export function stubSource(): string {
	const manifest = [
		{ name: "config", kind: "config", params: ["action", "key", "value"] },
		{ name: "install", kind: "dispatch", params: ["args"] },
		{ name: "lint", kind: "toolchain", params: ["args"] },
	];
	return `(() => {
	const sessions = ${JSON.stringify(STUB_SESSIONS)};
	const manifest = ${JSON.stringify(manifest)};
	async function invoke(command, args = {}) {
		if (command === "jyz_capabilities") return manifest;
		if (command === "jyz_version") return "jyz/0.0.0 walkthrough";
		if (command === "jyz_update_check") {
			return { current: "0.0.0", version: "9.9.9", notes: "walkthrough offer" };
		}
		if (command === "jyz_oc") {
			const argv = args.args ?? [];
			if (argv[0] === "sessions") return JSON.stringify(sessions);
			return JSON.stringify({ session: argv[3] ?? "", sent: true });
		}
		if (command === "jyz_call") {
			if (args.method === "config") {
				// The window sends "null" for a call with no params, so JSON.parse can hand back null.
				const params = JSON.parse(args.params || "{}") ?? {};
				if (params.json) {
					return JSON.stringify({ jsonrpc: "2.0", id: 1, result: { exitCode: 0, stdout: JSON.stringify({ project: { package_manager: { value: "bun", source: "config" }, typechecker: { value: "bun-check", source: "config" }, linter: { value: "biome", source: "config" }, formatter: { value: "bun-fmt", source: "config" } }, path: "/tmp/walkthrough/jyz.config.toml", layers: ["/tmp/walkthrough/jyz.config.toml"] }) } });
				}
				return JSON.stringify({ jsonrpc: "2.0", id: 1, result: { exitCode: 0, stdout: [
					"config: /tmp/walkthrough/jyz.config.toml",
					"project.package_manager = bun (detected)",
					"project.linter = biome (file)",
					"layer: /tmp/walkthrough",
				].join("\\n") } });
			}
			return JSON.stringify({ jsonrpc: "2.0", id: 1, result: { exitCode: 0, argv: ["bun", "install"] } });
		}
		throw new Error("unknown command " + command);
	}
	globalThis.__TAURI_INTERNALS__ = { invoke };
})();`;
}
