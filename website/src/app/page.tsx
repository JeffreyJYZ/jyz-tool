import { HeroWindow } from "@/ui/hero-window";

// The jyz product page: what the tool is, how to install it, and what it looks
// like. Every external link opens in a new tab so the page is never lost.

const INSTALL = "bun add -g jyz-tool";

const FACTS = [
	{ label: "config", value: "one file, `jyz.config.toml`" },
	{
		label: "delegates",
		value: "`bun`, `pnpm`, `cargo`: whatever the project already uses",
	},
	{ label: "ships", value: "CLI, MCP server, signed desktop app" },
];

export default function Home() {
	return (
		<>
			<section className="hero">
				<div className="hero-copy">
					<h1 className="hero-heading">
						One config file, any package manager.
					</h1>
					<p className="hero-sub">
						jyz reads what a project already uses and behaves that
						way: same commands, same lockfile, no second toolchain
						to keep in sync.
					</p>
					<div className="command-box">
						<div className="command-tabs">
							<span className="command-tab is-active">bun</span>
						</div>
						<p className="command-code">{INSTALL}</p>
					</div>
					<div className="hero-links">
						<a
							className="hero-link"
							href="https://github.com/JeffreyJYZ/jyz-tool"
							target="_blank"
							rel="noreferrer noopener"
						>
							GitHub
						</a>
						<a
							className="hero-link"
							href="https://github.com/JeffreyJYZ/jyz-tool/releases"
							target="_blank"
							rel="noreferrer noopener"
						>
							Releases
						</a>
						<a
							className="hero-link"
							href="https://github.com/JeffreyJYZ/jyz-tool#readme"
							target="_blank"
							rel="noreferrer noopener"
						>
							Docs
						</a>
					</div>
				</div>
				<div className="hero-shot">
					<HeroWindow />
				</div>
			</section>

			<section className="section">
				<div className="mx-auto max-w-xl text-center">
					<h2 className="section-heading">What it holds together</h2>
					<dl className="facts">
						{FACTS.map((fact) => (
							<div key={fact.label} className="fact">
								<dt className="fact-label">{fact.label}</dt>
								<dd className="fact-value">{fact.value}</dd>
							</div>
						))}
					</dl>
				</div>
			</section>
		</>
	);
}
