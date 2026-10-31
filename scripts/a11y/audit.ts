/**
 * The in-page half of the accessibility check.
 *
 * A Tauri window exposes no accessibility element, so the only way to prove the UI is reachable by
 * a screen reader is to load the same page in a real browser and audit the DOM the way assistive
 * technology reads it: landmarks, headings, accessible names, live regions, tab order. The function
 * below is serialised with `toString()` and evaluated in the page, so it must stay plain JavaScript
 * — no type annotations, no imports, nothing that a bundler would need to resolve.
 */

export type Finding = {
	kind: string;
	target: string;
	detail: string;
};

export type Audit = {
	screen: string;
	interactive: number;
	named: number;
	main: number;
	nav: boolean;
	footer: boolean;
	lang: string;
	currentTabs: number;
	liveRegions: number;
	regions: number;
	titledRegions: number;
	positiveTabindex: string[];
	duplicateIds: string[];
	unnamed: Finding[];
	findings: Finding[];
};

/** Runs inside the page; returns the audit for whichever screen is currently active. */
function collect(): Audit {
	const squash = (value: string | null): string => (value ?? "").replace(/\s+/g, " ").trim();
	const visible = (el: Element): boolean =>
		!!(el as HTMLElement).offsetParent || el.getClientRects().length > 0;
	const selector = (el: Element): string => {
		const id = el.getAttribute("id");
		if (id) return `#${id}`;
		const cls = el.getAttribute("class");
		const tag = el.tagName.toLowerCase();
		return cls ? `${tag}.${cls.split(/\s+/).join(".")}` : tag;
	};
	const nameOf = (el: Element): string => {
		const direct = squash(el.getAttribute("aria-label"));
		if (direct !== "") return direct;
		const ids = squash(el.getAttribute("aria-labelledby")).split(" ").filter(Boolean);
		const referenced = ids
			.map((id) => squash(document.getElementById(id)?.textContent ?? ""))
			.join(" ");
		if (squash(referenced) !== "") return squash(referenced);
		const id = el.getAttribute("id");
		if (id) {
			const label = document.querySelector(`label[for="${CSS.escape(id)}"]`);
			if (label && squash(label.textContent) !== "") return squash(label.textContent);
		}
		const wrapper = el.closest("label");
		if (wrapper && squash(wrapper.textContent) !== "") return squash(wrapper.textContent);
		const tag = el.tagName;
		if (tag === "BUTTON" || tag === "A" || tag === "SELECT" || tag === "SUMMARY") {
			const text = squash(el.textContent);
			if (text !== "") return text;
		}
		if (tag === "INPUT") {
			const input = el as HTMLInputElement;
			if ((input.type === "submit" || input.type === "button") && input.value)
				return input.value;
		}
		return "";
	};

	const active = document.querySelector(".screen.active") ?? document.body;
	const screen = active.getAttribute("id") ?? "unknown";
	const interactive = [
		...active.querySelectorAll(
			'a[href], button, input:not([type="hidden"]), select, textarea, [tabindex]:not([tabindex="-1"])',
		),
	].filter((el) => !(el as HTMLButtonElement).disabled && visible(el));
	const unnamed: Finding[] = [];
	for (const el of interactive) {
		if (nameOf(el) === "")
			unnamed.push({ kind: "name", target: selector(el), detail: el.tagName });
	}

	const regions = [
		...(active.matches('[role="region"], section') ? [active] : []),
		...active.querySelectorAll('[role="region"], section'),
	];
	const titled = regions.filter((el) => {
		const ids = squash(el.getAttribute("aria-labelledby")).split(" ").filter(Boolean);
		return ids.some((id) => squash(document.getElementById(id)?.textContent ?? "") !== "");
	});

	const seen = new Map<string, number>();
	for (const el of document.querySelectorAll("[id]")) {
		const id = el.getAttribute("id") ?? "";
		seen.set(id, (seen.get(id) ?? 0) + 1);
	}
	const duplicateIds = [...seen.entries()].filter(([, n]) => n > 1).map(([id]) => id);

	const positive = [...document.querySelectorAll("[tabindex]")]
		.filter((el) => Number(el.getAttribute("tabindex")) > 0)
		.map(selector);

	const findings: Finding[] = [];
	if (unnamed.length > 0) {
		findings.push({
			kind: "unnamed-control",
			target: unnamed.map((f) => f.target).join(", "),
			detail: `${unnamed.length} control(s) with no accessible name`,
		});
	}
	if (duplicateIds.length > 0) {
		findings.push({
			kind: "duplicate-id",
			target: duplicateIds.join(", "),
			detail: "ids repeat",
		});
	}
	if (positive.length > 0) {
		findings.push({
			kind: "positive-tabindex",
			target: positive.join(", "),
			detail: "tab order is reordered",
		});
	}

	return {
		screen,
		interactive: interactive.length,
		named: interactive.length - unnamed.length,
		main: document.querySelectorAll("main").length,
		nav: document.querySelector("nav[aria-label]") !== null,
		footer: document.querySelector("footer") !== null,
		lang: squash(document.documentElement.getAttribute("lang")),
		currentTabs: document.querySelectorAll('nav [aria-current="page"]').length,
		liveRegions: document.querySelectorAll('[role="status"], [role="alert"], [aria-live]')
			.length,
		regions: regions.length,
		titledRegions: titled.length,
		positiveTabindex: positive,
		duplicateIds,
		unnamed,
		findings,
	};
}

/** The expression an `agent-browser eval` runs to produce an {@link Audit}. */
export function collectSource(): string {
	return `(${collect.toString()})()`;
}

/** Structural problems that hold for the whole document, independent of the active screen. */
export function judge(audit: Audit): Finding[] {
	const findings = [...audit.findings];
	if (audit.lang === "") {
		findings.push({ kind: "lang", target: "html", detail: "no lang attribute" });
	}
	if (audit.main !== 1) {
		findings.push({ kind: "landmark", target: "main", detail: `found ${audit.main}` });
	}
	if (!audit.nav) {
		findings.push({ kind: "landmark", target: "nav", detail: "nav has no aria-label" });
	}
	if (!audit.footer) {
		findings.push({ kind: "landmark", target: "footer", detail: "no footer element" });
	}
	if (audit.currentTabs !== 1) {
		findings.push({
			kind: "current-tab",
			target: "nav [aria-current]",
			detail: `expected 1, found ${audit.currentTabs}`,
		});
	}
	if (audit.liveRegions < 1) {
		findings.push({ kind: "live-region", target: "document", detail: "no status region" });
	}
	if (audit.regions === 0 || audit.titledRegions < audit.regions) {
		findings.push({
			kind: "region-heading",
			target: audit.screen,
			detail: `${audit.titledRegions}/${audit.regions} regions carry a heading`,
		});
	}
	return findings;
}
