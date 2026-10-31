import { INVALID_PARAMS, RpcError } from "./errors.ts";

export interface CallParams {
	args?: string[];
	dev?: boolean;
	latest?: boolean;
	filter?: string;
	check?: boolean;
	action?: string;
	key?: string;
	value?: string;
	strict?: boolean;
	name?: string;
}

export function readParams(params: unknown): CallParams {
	if (params === undefined || params === null) return {};
	if (typeof params !== "object" || Array.isArray(params)) {
		throw new RpcError(INVALID_PARAMS, "params must be an object");
	}
	const raw = params as Record<string, unknown>;
	const out: CallParams = {};
	if (raw.args !== undefined) out.args = stringList(raw.args, "args");
	if (raw.dev !== undefined) out.dev = flag(raw.dev, "dev");
	if (raw.latest !== undefined) out.latest = flag(raw.latest, "latest");
	if (raw.filter !== undefined) out.filter = stringValue(raw.filter, "filter");
	if (raw.check !== undefined) out.check = flag(raw.check, "check");
	if (raw.action !== undefined) out.action = stringValue(raw.action, "action");
	if (raw.key !== undefined) out.key = stringValue(raw.key, "key");
	if (raw.value !== undefined) out.value = stringValue(raw.value, "value");
	if (raw.strict !== undefined) out.strict = flag(raw.strict, "strict");
	if (raw.name !== undefined) out.name = stringValue(raw.name, "name");
	return out;
}

function stringList(value: unknown, field: string): string[] {
	if (!Array.isArray(value) || value.some((entry) => typeof entry !== "string")) {
		throw new RpcError(INVALID_PARAMS, `params.${field} must be an array of strings`);
	}
	return [...value];
}

function stringValue(value: unknown, field: string): string {
	if (typeof value !== "string") {
		throw new RpcError(INVALID_PARAMS, `params.${field} must be a string`);
	}
	return value;
}

function flag(value: unknown, field: string): boolean {
	if (typeof value !== "boolean") {
		throw new RpcError(INVALID_PARAMS, `params.${field} must be a boolean`);
	}
	return value;
}
