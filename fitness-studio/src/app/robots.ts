import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { indexable } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  if (!indexable()) return { rules: { userAgent: "*", disallow: "/" } };
  // AI assistants (ChatGPT, Claude, Perplexity, Gemini…) are welcome too – the "*" rule covers them.
  return {
    rules: { userAgent: "*", allow: "/", disallow: ["/admin", "/ucet", "/platba", "/api", "/o/"] },
    sitemap: `${site.url}/sitemap.xml`,
    host: site.url,
  };
}
