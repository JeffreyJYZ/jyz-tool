declare module "*.css" {
	const content: string;
	export default content;
}

/**
 * The screen modules publish their loaders and timers on `window` so a tab click can drive them
 * without the tab strip importing every screen. Declared once here, so no call site needs a cast.
 */
interface Window {
	__configLoad?: () => void;
	__settingsLoad?: () => void;
	__ocLoad?: () => void;
	__ocStart?: () => void;
	__ocStop?: () => void;
	__renderUpdate?: (
		offer: { current: string; version: string; notes: string | null } | null,
	) => void;
	__TAURI_INTERNALS__?: { invoke: (command: string, args?: unknown) => Promise<unknown> };
}
