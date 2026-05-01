import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactCompiler: true,
  experimental: {
    serverActions: {
      // Allow up to 12 MB to accommodate map image + GPX uploads
      bodySizeLimit: "12mb",
    },
  },
};

export default nextConfig;
