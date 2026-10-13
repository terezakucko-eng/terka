import { eq } from "drizzle-orm";
import { cache } from "react";
import { getDb, type Executor } from "@/db";
import { settings } from "@/db/schema";

/**
 * Pictures on the web made with AI, by their URL. They show a small
 * "Ilustrační foto · AI" label (the EU AI Act wants realistic AI images
 * disclosed). Marked in Admin → Obrázky (AI).
 */
const KEY = "aiImages";

export async function aiImageList(db: Executor): Promise<string[]> {
  const [row] = await db.select().from(settings).where(eq(settings.key, KEY));
  const value: unknown = row?.value;
  return Array.isArray(value) ? value.filter((v): v is string => typeof v === "string") : [];
}

/** Marks (or unmarks) the given pictures as made with AI. */
export async function setAiImages(db: Executor, srcs: string[], on: boolean) {
  const list = new Set(await aiImageList(db));
  for (const src of srcs.map((s) => s.trim()).filter(Boolean)) {
    if (on) list.add(src);
    else list.delete(src);
  }
  const value = [...list].sort();
  await db.insert(settings).values({ key: KEY, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/** Once per request – every ContentImage on the page asks. */
export const aiImages = cache(async () => new Set(await aiImageList(await getDb())));
