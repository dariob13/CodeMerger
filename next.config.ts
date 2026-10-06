import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Keep the development badge clear of the bottom-left account button.
  devIndicators: { position: "bottom-right" },
  experimental: {
    // Uploads pass through proxy.ts, which buffers request bodies up to this size.
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
