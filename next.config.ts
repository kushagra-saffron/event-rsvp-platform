import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // When the repo lives inside a directory that also has a package-lock.json,
  // Turbopack can pick the wrong root; pin it to this app.
  turbopack: {
    root: process.cwd(),
  },
};

export default nextConfig;
