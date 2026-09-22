import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // embedded Postgres (local dev) ships WASM – keep it out of the bundle
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  experimental: {
    // photo uploads in the admin (resized on the server)
    serverActions: { bodySizeLimit: "13mb" },
  },
  images: {
    localPatterns: [
      { pathname: "/img/**", search: "" },
      { pathname: "/brand/**", search: "" },
      { pathname: "/media/**", search: "" },
    ],
  },
};

export default nextConfig;
