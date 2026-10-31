// Accessibility helpers for the desktop shell, kept tiny so shell.ts stays under 200 lines.

/** Build a screen section with a real heading and an accessible name. */
export function makeScreen(id: string, active: boolean, headingText: string): HTMLElement {
	const sec = document.createElement("section");
	sec.className = `screen${active ? " active" : ""}`;
	sec.id = id;
	sec.setAttribute("role", "region");
	const heading = document.createElement("h2");
	heading.id = `${id}-heading`;
	heading.textContent = headingText;
	sec.setAttribute("aria-labelledby", heading.id);
	sec.append(heading);
	return sec;
}

/** Mark an element as a polite live region. */
export function markLive(el: HTMLElement): void {
	el.setAttribute("role", "status");
	el.setAttribute("aria-live", "polite");
}
