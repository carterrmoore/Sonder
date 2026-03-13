import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    turbo: {
      enabled: false,
    },
  },
};

export default nextConfig;
