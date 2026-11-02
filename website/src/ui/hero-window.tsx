"use client";

import { Bar, Stage, Text, Window } from "./stageshow/kit";
import "./stageshow/theme.css";
import "./hero-window.css";

// The hero product shot: a faux jyz window, not a screenshot. Real words only
// where the eye lands (the selected project, its tool, its status); bars
// everywhere else, so nothing on screen is a claim about a real project.

const TABS = ["Projects", "Session", "Config"];

const ROWS: {
	name: string;
	tool: string;
	status: string;
	selected?: boolean;
}[] = [
	{ name: "website", tool: "bun", status: "running", selected: true },
	{ name: "api", tool: "cargo", status: "idle" },
	{ name: "cli", tool: "bun", status: "idle" },
	{ name: "docs", tool: "biome", status: "idle" },
];

export function HeroWindow() {
	return (
		<Stage
			width={760}
			height={400}
			compact={{ below: 400, width: 340, height: 300 }}
			theme="dark"
			palette="mono"
			className="hw"
		>
			{() => (
				<Window title="jyz" className="hw-window">
					<div className="hw-tabs">
						{TABS.map((label, i) => (
							<Text
								key={label}
								className="hw-tab"
								data-on={i === 0 || undefined}
							>
								{label}
							</Text>
						))}
					</div>

					<div className="hw-banner">
						<Text className="hw-banner-text">Update available</Text>
						<Bar w={54} h={20} r={5} tone={4} />
					</div>

					<div className="hw-head">
						<Text className="hw-head-cell">project</Text>
						<Text className="hw-head-cell">tool</Text>
						<Text className="hw-head-cell">status</Text>
					</div>

					<div className="hw-rows">
						{ROWS.map((row) => (
							<div
								key={row.name}
								className="hw-row"
								data-selected={row.selected || undefined}
							>
								<Text
									className={
										row.selected
											? "hw-name"
											: "hw-name hw-dim"
									}
								>
									{row.name}
								</Text>
								<Text
									className={
										row.selected
											? "hw-tool"
											: "hw-tool hw-dim"
									}
								>
									{row.tool}
								</Text>
								{row.selected ? (
									<Text className="hw-status">
										{row.status}
									</Text>
								) : (
									<Bar w={34} tone={2} />
								)}
							</div>
						))}
					</div>
				</Window>
			)}
		</Stage>
	);
}
