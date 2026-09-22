import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // embedded Postgres (local dev) ships WASM – keep it out of the bundle
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
};

export default nextConfig;
