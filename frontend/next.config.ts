import type { NextConfig } from "next";

const isGhPages = process.env.GITHUB_ACTIONS === "true";
const basePath = isGhPages ? "/BudgetOnTarget" : "";

const nextConfig: NextConfig = {
  output: "export",
  basePath,
  assetPrefix: isGhPages ? "/BudgetOnTarget/" : "",
  env: {
    NEXT_PUBLIC_BASE_PATH: basePath,
  },
};

export default nextConfig;
