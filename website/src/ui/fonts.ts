import localFont from "next/font/local";

export const fontSFPro = localFont({
	fallback: ["sans-serif"],
	src: [
		{
			path: "../../public/fonts/sf-pro/SF-Pro.ttf",
			style: "normal",
			weight: "1 1000",
		},
		{
			path: "../../public/fonts/sf-pro/SF-Pro-Italic.ttf",
			style: "italic",
			weight: "1 1000",
		},
	],
	variable: "--sf-pro",
	display: "fallback",
});

export const fontLora = localFont({
	fallback: ["serif"],
	src: [
		{
			path: "../../public/fonts/lora/Lora.ttf",
			style: "normal",
			weight: "400 700",
		},
		{
			path: "../../public/fonts/lora/Lora-Italic.ttf",
			style: "italic",
			weight: "400 700",
		},
	],
	variable: "--lora",
	display: "fallback",
});

export const fontSFMono = localFont({
	fallback: ["monospace"],
	src: [
		{
			path: "../../public/fonts/sf-mono/SF-Mono-Light.otf",
			style: "normal",
			weight: "300",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-LightItalic.otf",
			style: "italic",
			weight: "300",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-Regular.otf",
			style: "normal",
			weight: "400",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-RegularItalic.otf",
			style: "italic",
			weight: "400",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-Medium.otf",
			style: "normal",
			weight: "500",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-MediumItalic.otf",
			style: "italic",
			weight: "500",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-Semibold.otf",
			style: "normal",
			weight: "600",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-SemiboldItalic.otf",
			style: "italic",
			weight: "600",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-Bold.otf",
			style: "normal",
			weight: "700",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-BoldItalic.otf",
			style: "italic",
			weight: "700",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-Heavy.otf",
			style: "normal",
			weight: "800",
		},
		{
			path: "../../public/fonts/sf-mono/SF-Mono-HeavyItalic.otf",
			style: "italic",
			weight: "800",
		},
	],
	variable: "--sf-mono",
	display: "fallback",
});
