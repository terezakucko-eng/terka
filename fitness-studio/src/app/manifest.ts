import type { MetadataRoute } from "next";
import { site } from "@/config/site";

/** Lets clients add the site to the phone's home screen as an app (opens the account, card one tap away). */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: site.name,
    short_name: site.name,
    description: "Rozvrh, rezervace a členská karta studia OCTOPUSH.",
    lang: "cs",
    start_url: "/ucet",
    scope: "/",
    display: "standalone",
    background_color: "#151a13",
    theme_color: "#1a281b",
    icons: [
      { src: "/icon.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/apple-icon.png", sizes: "180x180", type: "image/png" },
    ],
    shortcuts: [
      { name: "Členská karta", url: "/ucet/karta" },
      { name: "Rozvrh", url: "/rozvrh" },
    ],
  };
}
