/**
 * The two pieces of chrome around the screens: the update banner and the version footer.
 *
 * They live here so `shell.ts` stays inside the 200-line budget. Both are plain elements the page
 * fills in later — the banner by `updates.ts`, the footer by the version lookup in `main.ts` — and
 * neither holds state.
 */

export function makeBanner(doc: Document = document): HTMLDivElement {
	const banner = doc.createElement("div");
	banner.id = "update-banner";
	banner.hidden = true;
	banner.setAttribute("role", "status");
	banner.setAttribute("aria-live", "polite");
	return banner;
}

export function makeFooter(doc: Document = document): HTMLElement {
	const footer = doc.createElement("footer");
	footer.id = "version";
	footer.textContent = "jyz · checking";
	return footer;
}

/** The screen switcher. The first tab is current from the first paint, before main.ts runs. */
export function makeTabs(doc: Document = document): HTMLElement {
	const nav = doc.createElement("nav");
	nav.className = "tabs";
	nav.id = "tabs";
	nav.setAttribute("aria-label", "Screens");
	for (const name of ["call", "config", "projects", "opencode", "settings"]) {
		const btn = doc.createElement("button");
		btn.type = "button";
		btn.dataset.screen = name;
		btn.textContent =
			name === "opencode" ? "opencode" : name.charAt(0).toUpperCase() + name.slice(1);
		if (name === "call") {
			btn.classList.add("active");
			btn.setAttribute("aria-current", "page");
		}
		nav.append(btn);
	}
	return nav;
}
