import type { MetadataRoute } from "next";
import { site } from "@/config/site";

export default function sitemap(): MetadataRoute.Sitemap {
  return ["", "/rozvrh", "/lekce", "/cenik", "/o-mne", "/registrace", "/obchodni-podminky", "/ochrana-osobnich-udaju"].map(
    (p) => ({ url: `${site.url}${p}`, changeFrequency: p === "/rozvrh" ? "daily" : "monthly" }),
  );
}
