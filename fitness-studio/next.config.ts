import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // embedded Postgres (local dev) ships WASM – keep it out of the bundle
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  // self-contained server bundle for the Docker image (ignored by Vercel)
  output: "standalone",
  // studio is run by one instructor – the old team page lives on as "O mně"
  async redirects() {
    return [{ source: "/lektori", destination: "/o-mne", permanent: true }];
  },
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
