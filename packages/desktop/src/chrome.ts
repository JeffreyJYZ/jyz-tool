/**
 * The two pieces of chrome around the screens: the update banner and the version footer.
 *
 * They live here so `shell.ts` stays inside the 200-line budget. Both are plain elements the page
 * fills in later — the banner by `updates.ts`, the footer by the version lookup in `main.ts` — and
 * neither holds state.
 */

export function makeBanner(): HTMLDivElement {
	const banner = document.createElement("div");
	banner.id = "update-banner";
	banner.hidden = true;
	banner.setAttribute("role", "status");
	banner.setAttribute("aria-live", "polite");
	return banner;
}

export function makeFooter(): HTMLElement {
	const footer = document.createElement("footer");
	footer.id = "version";
	footer.textContent = "jyz · checking";
	return footer;
}
