import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // A run row changes on almost every operator action, and the client router cache
  // was serving a stale run after an upload or a beat sheet regenerate.
  experimental: {
    staleTimes: { dynamic: 0, static: 30 },
  },
};

export default nextConfig;
