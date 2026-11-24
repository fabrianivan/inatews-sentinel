import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // The service worker (browser notifications only) must never be served from a cache, so a
  // fixed version reaches every browser; it may load scripts from this site alone.
  async headers() {
    return [
      {
        source: "/sw.js",
        headers: [
          { key: "Content-Type", value: "application/javascript; charset=utf-8" },
          { key: "Cache-Control", value: "no-cache, no-store, must-revalidate" },
          { key: "Content-Security-Policy", value: "default-src 'self'; script-src 'self'" },
        ],
      },
    ];
  },
};

export default nextConfig;
