import type { MetadataRoute } from "next";
import { site } from "@/config/site";
import { getDb } from "@/db";
import { activeMassageServices } from "@/domain/massages";
import { activeClassTypes } from "@/lib/queries";

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const db = await getDb();
  const [massages, lessons] = await Promise.all([activeMassageServices(db).catch(() => []), activeClassTypes(db).catch(() => [])]);
  const pages: [string, number][] = [
    ["", 1],
    ["/rozvrh", 0.9],
    ["/lekce", 0.9],
    ["/cenik", 0.9],
    ["/masaze", 0.8],
    ["/o-mne", 0.7],
    ["/nastenka", 0.6],
    ["/recenze", 0.6],
    ["/registrace", 0.5],
    ["/obchodni-podminky", 0.2],
    ["/ochrana-osobnich-udaju", 0.2],
  ];
  return [
    ...pages.map(([p, priority]) => ({
      url: `${site.url}${p}`,
      changeFrequency: (p === "/rozvrh" || p === "/nastenka" ? "daily" : "monthly") as "daily" | "monthly",
      priority,
    })),
    ...lessons.map((t) => ({ url: `${site.url}/lekce/${t.slug}`, changeFrequency: "weekly" as const, priority: 0.8 })),
    ...massages.map((m) => ({ url: `${site.url}/masaze/${m.slug}`, changeFrequency: "monthly" as const, priority: 0.6 })),
  ];
}
