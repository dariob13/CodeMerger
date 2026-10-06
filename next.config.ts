import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  experimental: {
    // Uploads pass through proxy.ts, which buffers request bodies up to this size.
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
