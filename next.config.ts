import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The desktop app ships a local server, including its traced runtime dependencies.
  output: process.env.CODE_MERGER_DESKTOP === "1" ? "standalone" : undefined,
  outputFileTracingExcludes: process.env.CODE_MERGER_DESKTOP === "1" ? {
    "/*": ["./data/**/*", "./workspace/**/*", "./.old/**/*", "./.git/**/*", "./Code Merger/**/*", "./landing-page/**/*", "./src-tauri/**/*", "./desktop/**/*", "./dist/**/*", "./.env*"],
  } : undefined,
  // Isolated previews/tests can run alongside an existing development server.
  distDir: process.env.CODE_MERGER_BUILD_DIR || ".next",
  typescript: { tsconfigPath: process.env.CODE_MERGER_TSCONFIG || "tsconfig.json" },
  // Keep the development badge clear of the bottom-left account button.
  devIndicators: { position: "bottom-right" },
  experimental: {
    // Uploads pass through proxy.ts, which buffers request bodies up to this size.
    proxyClientMaxBodySize: "30mb",
  },
};

export default nextConfig;
