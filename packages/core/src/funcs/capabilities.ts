/**
 * The capability manifest: every verb jyz answers to, in one deterministic list.
 *
 * This is the seam the desktop parity rule rests on. The CLI registers commands and the JSON-RPC
 * server dispatches them; both read their names from here, so a verb that exists in one surface and
 * not the other is a test failure rather than a discovery.
 *
 * Order is declaration order and mirrors the registration order in `bin.ts`: the config and create
 * groups first, then the dispatch verbs in their documented table order, then the toolchain verbs.
 * `params` names the positional parameters a caller may pass, never the flags.
 */

export type CapabilityKind = "dispatch" | "config" | "create" | "toolchain";

export interface Capability {
	name: string;
	kind: CapabilityKind;
	params: string[];
}

const CONFIG: Capability[] = [
	{ name: "config", kind: "config", params: ["action", "key", "value"] },
];

const CREATE: Capability[] = [{ name: "create", kind: "create", params: ["name"] }];

const DISPATCH: Capability[] = [
	{ name: "install", kind: "dispatch", params: ["args"] },
	{ name: "add", kind: "dispatch", params: ["packages"] },
	{ name: "remove", kind: "dispatch", params: ["packages"] },
	{ name: "run", kind: "dispatch", params: ["script", "args"] },
	{ name: "exec", kind: "dispatch", params: ["bin", "args"] },
	{ name: "update", kind: "dispatch", params: ["packages"] },
	{ name: "outdated", kind: "dispatch", params: [] },
];

const TOOLCHAIN: Capability[] = [
	{ name: "lint", kind: "toolchain", params: ["args"] },
	{ name: "typecheck", kind: "toolchain", params: ["args"] },
	{ name: "check", kind: "toolchain", params: ["args"] },
	{ name: "fmt", kind: "toolchain", params: [] },
];

const CAPABILITIES: readonly Capability[] = Object.freeze([
	...CONFIG,
	...CREATE,
	...DISPATCH,
	...TOOLCHAIN,
]);

/** Every capability, in registration order. Each call returns fresh copies, so callers may edit. */
export function listCapabilities(): Capability[] {
	return CAPABILITIES.map((capability) => ({
		name: capability.name,
		kind: capability.kind,
		params: [...capability.params],
	}));
}

/** One capability by name, or null when jyz has no such verb. Aliases are not capabilities. */
export function findCapability(name: string): Capability | null {
	const capability = CAPABILITIES.find((candidate) => candidate.name === name);
	if (capability === undefined) return null;
	return { name: capability.name, kind: capability.kind, params: [...capability.params] };
}
