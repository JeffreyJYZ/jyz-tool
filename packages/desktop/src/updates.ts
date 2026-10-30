// Desktop update shaping, kept free of Tauri so bun:test can reach it.
//
// The page in ui/index.html drives the updater through the bridge; the helpers here are
// the pure parts (shaping the offer into banner text) that the page mirrors in plain JS.

export interface UpdateOffer {
	current: string;
	version: string;
	notes: string | null;
}

export interface UpdateDescription {
	headline: string;
	detail: string;
}

/** Shape an update offer into banner text; null when there is nothing to offer. */
export function describeUpdate(
	offer: { current: string; version: string; notes: string | null } | null,
): { headline: string; detail: string } | null {
	if (offer === null) return null;
	return {
		headline: `update available: ${offer.version}`,
		detail: offer.notes === null ? "" : offer.notes,
	};
}

/** One-line message for a failed update check. */
export function updateCheckFailed(error: unknown): string {
	if (error instanceof Error) return error.message;
	return String(error);
}
