import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep Next from generating AGENTS.md / CLAUDE.md into the repo.
  agentRules: false,
};

export default nextConfig;
