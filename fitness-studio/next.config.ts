import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // embedded Postgres (local dev) ships WASM – keep it out of the bundle
  serverExternalPackages: ["@electric-sql/pglite"],
  poweredByHeader: false,
  // self-contained server bundle for the Docker image (ignored by Vercel)
  output: "standalone",
  // fonts and logos read from disk by the stories image
  outputFileTracingIncludes: {
    "/api/story/\\[id\\]": ["./assets/fonts/**/*", "./public/brand/*.svg"],
  },
  // browser-side hardening: HTTPS only, no framing (clickjacking), no MIME sniffing
  async headers() {
    return [
      {
        source: "/:path*",
        headers: [
          { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
          { key: "X-Frame-Options", value: "DENY" },
          { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self';" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(self)" },
        ],
      },
    ];
  },
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
