import { describe, expect, test } from "bun:test";
import { listCapabilities } from "../../core/src/funcs/capabilities.ts";
import {
	BridgeError,
	buildCall,
	formatResult,
	METHODS,
	mapError,
	normalizeParams,
	readResponse,
	readResult,
} from "../src/bridge.ts";

const OK = '{"jsonrpc":"2.0","id":1,"result":{"exitCode":0,"argv":["bun","run","build"]}}';

describe("request shaping", () => {
	test("buildCall trims the method and compacts the params", () => {
		expect(buildCall("  config  ", '{ "action": "show" }')).toEqual({
			method: "config",
			params: '{"action":"show"}',
		});
	});

	test("blank params become null", () => {
		expect(normalizeParams("   ")).toBe("null");
	});

	test("params keep their shape", () => {
		expect(normalizeParams('{"args":["--watch"],"dev":true}')).toBe(
			'{"args":["--watch"],"dev":true}',
		);
	});

	test("params that are not JSON are refused before a child is spawned", () => {
		expect(() => buildCall("run", "{oops")).toThrow(BridgeError);
		expect(() => buildCall("run", "{oops")).toThrow(/params is not JSON/);
	});

	test("an empty method is refused", () => {
		expect(() => buildCall("   ", "{}")).toThrow(/pick a method first/);
	});

	test("the offered methods cover every capability in the manifest", () => {
		const names = listCapabilities().map((capability) => capability.name);
		expect([...(METHODS as readonly string[])].sort()).toEqual(names.sort());
	});
});

describe("result extraction", () => {
	test("readResult returns the result member", () => {
		expect(readResult(OK)).toEqual({ exitCode: 0, argv: ["bun", "run", "build"] });
	});

	test("readResponse accepts a successful frame", () => {
		expect(readResponse(OK).id).toBe(1);
	});

	test("a frame without a result is an error", () => {
		expect(() => readResult('{"jsonrpc":"2.0","id":1}')).toThrow(/carried no result/);
	});

	test("formatResult pretty-prints a result", () => {
		expect(formatResult({ exitCode: 1, stderr: "no project" })).toBe(
			'{\n  "exitCode": 1,\n  "stderr": "no project"\n}',
		);
	});

	test("formatResult prints undefined as text", () => {
		expect(formatResult(undefined)).toBe("undefined");
	});
});

describe("error mapping", () => {
	test("a JSON-RPC error keeps its code and message", () => {
		const line =
			'{"jsonrpc":"2.0","id":1,"error":{"code":-32601,"message":"unknown method \\"nope\\""}}';
		const error = (() => {
			try {
				readResult(line);
			} catch (caught) {
				return caught;
			}
			return null;
		})();
		expect(error).toBeInstanceOf(BridgeError);
		expect((error as BridgeError).code).toBe(-32601);
		expect((error as BridgeError).message).toBe('unknown method "nope"');
		expect(mapError(error)).toBe('unknown method "nope" (-32601)');
	});

	test("a transport error string maps to itself", () => {
		expect(mapError("could not start jyz: No such file or directory")).toBe(
			"could not start jyz: No such file or directory",
		);
	});

	test("an Error maps to its message", () => {
		expect(mapError(new Error("boom"))).toBe("boom");
	});

	test("an answer that is not JSON is a BridgeError without a code", () => {
		const error = (() => {
			try {
				readResponse("not json");
			} catch (caught) {
				return caught;
			}
			return null;
		})();
		expect(error).toBeInstanceOf(BridgeError);
		expect((error as BridgeError).code).toBeNull();
		expect(mapError(error)).toBe(
			'answer is not JSON: JSON Parse error: Unexpected identifier "not"',
		);
	});

	test("a frame that is not JSON-RPC 2.0 is refused", () => {
		expect(() => readResponse('{"id":1,"result":3}')).toThrow(/not JSON-RPC 2.0/);
	});

	test("a frame that is not an object is refused", () => {
		expect(() => readResponse("[]")).toThrow(/not a JSON-RPC message/);
	});

	test("an error member without a code maps to its message alone", () => {
		const line = '{"jsonrpc":"2.0","id":1,"error":{"message":"bad params"}}';
		expect(() => readResult(line)).toThrow(/bad params/);
		expect(mapError(new BridgeError("bad params"))).toBe("bad params");
	});
});
