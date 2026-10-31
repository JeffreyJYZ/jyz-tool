// The page side of a native menu action.
//
// "Check for Updates…" in the app menu runs in Rust, so its answer arrives as a Tauri event, not as
// a promise the page awaited. The page has no `@tauri-apps/api` dependency — `invoke` comes off
// `__TAURI_INTERNALS__` — so this subscribes through the same internals: `transformCallback` hands
// back the numeric handler id the event plugin wants, and `plugin:event|listen` registers it.
// Outside the window the internals are absent and this is a no-op, which is what the walkthrough
// and bun:test see.

type Internals = {
	invoke?: (cmd: string, args?: Record<string, unknown>) => Promise<unknown>;
	transformCallback?: (callback: (payload: unknown) => void, once?: boolean) => number;
};

/** The Rust command returns `Result<Option<UpdateOffer>, String>`, which serialises as `{"Ok": …}`. */
export function unwrapResult(payload: unknown): { offer: unknown } | { error: string } {
	if (payload !== null && typeof payload === "object" && "Ok" in payload) {
		return { offer: (payload as { Ok: unknown }).Ok };
	}
	if (payload !== null && typeof payload === "object" && "Err" in payload) {
		const error = (payload as { Err: unknown }).Err;
		return { error: typeof error === "string" ? error : JSON.stringify(error) };
	}
	return { offer: payload };
}

/** Subscribe to any event the native side emits. Returns an unsubscribe function, or null outside the window. */
export function listen(event: string, handler: (payload: unknown) => void): (() => void) | null {
	const internals = (globalThis as { __TAURI_INTERNALS__?: Internals }).__TAURI_INTERNALS__;
	if (!internals?.invoke || !internals.transformCallback) return null;
	const id = internals.transformCallback((message) => {
		const payload = (message as { payload?: unknown })?.payload ?? message;
		handler(payload);
	});
	internals
		.invoke("plugin:event|listen", { event, target: { kind: "Any" }, handler: id })
		.catch(() => {});
	return () => {
		internals.invoke?.("plugin:event|unlisten", { event, eventId: id }).catch(() => {});
	};
}

/** Subscribe to an update-check result. Returns an unsubscribe function, or null outside the window. */
export function listenUpdateCheck(handler: (payload: unknown) => void): (() => void) | null {
	return listen("jyz:update-check-result", handler);
}

/** Subscribe to download progress: `{ downloaded, total }` in bytes. */
export function listenUpdateProgress(
	handler: (progress: { downloaded: number; total: number | null }) => void,
): (() => void) | null {
	return listen("jyz:update-progress", (payload) => {
		const value = payload as { downloaded?: number; total?: number | null } | null;
		handler({ downloaded: Number(value?.downloaded ?? 0), total: value?.total ?? null });
	});
}
