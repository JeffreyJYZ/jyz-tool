import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";
import { fontLora, fontSFMono, fontSFPro } from "@/ui/fonts";

export const metadata: Metadata = {
	title: "jyz — one config file, any package manager",
	description:
		"jyz is a CLI that behaves as whatever package manager a project already uses: one config file, thin adapters, no lock-in.",
};

export default function RootLayout({
	children,
}: Readonly<{
	children: React.ReactNode;
}>) {
	return (
		<html
			lang="en"
			data-scroll-behavior="smooth"
			className={`${fontSFPro.variable} ${fontLora.variable} ${fontSFMono.variable} antialiased`}
		>
			<body>
				<div className="site-shell">
					<div className="site-container">
						<nav className="site-nav">
							<Link className="site-nav-brand" href="/">
								jyz
							</Link>
							<div className="site-nav-links">
								<Link
									className="site-nav-link"
									href="https://jyz.land"
								>
									jyz.land
								</Link>
								<Link
									className="site-nav-link"
									href="https://github.com/JeffreyJYZ/jyz-tool"
									target="_blank"
									rel="noreferrer noopener"
								>
									GitHub
								</Link>
								<Link
									className="site-nav-link"
									href="https://github.com/JeffreyJYZ/jyz-tool/releases"
									target="_blank"
									rel="noreferrer noopener"
								>
									Releases
								</Link>
							</div>
						</nav>
						<hr className="sep" />
						<main>{children}</main>
						<hr className="sep" />
						<footer className="site-footer">
							<div className="site-footer-links">
								<Link
									className="site-nav-link"
									href="https://github.com/JeffreyJYZ"
									target="_blank"
									rel="noopener"
								>
									GitHub
								</Link>
							</div>
							<span>© 2026 Yizhou Jiang</span>
						</footer>
					</div>
				</div>
			</body>
		</html>
	);
}
