import type { NextConfig } from "next";

const nextConfig: NextConfig = {
	/* config options here */
	reactCompiler: true,
	async redirects() {
		return [
			{
				source: "/vobes",
				destination: "https://vobes.jyz.land",
				permanent: true,
			},
		];
	},
};

export default nextConfig;
