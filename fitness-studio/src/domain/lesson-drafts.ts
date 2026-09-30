import { eq, isNull } from "drizzle-orm";
import type { Executor } from "@/db";
import { classTypes, settings } from "@/db/schema";
import { templateFor } from "./lesson-templates";

const HIDDEN = "hiddenLessonDrafts";

/** Drafts the admin removed from "Připravené návrhy lekcí". */
export async function hiddenDrafts(db: Executor) {
  const [row] = await db.select().from(settings).where(eq(settings.key, HIDDEN));
  return new Set(Array.isArray(row?.value) ? (row.value as string[]) : []);
}

export async function setDraftHidden(db: Executor, slug: string, hidden: boolean) {
  const set = await hiddenDrafts(db);
  if (hidden) set.add(slug);
  else set.delete(slug);
  const value = [...set];
  await db.insert(settings).values({ key: HIDDEN, value }).onConflictDoUpdate({ target: settings.key, set: { value } });
}

/**
 * Every lesson with a matching draft gets its description and search terms.
 * Name, prices, photo, schedule and "Aktivní" stay as they are.
 */
export async function fillLessonsFromDrafts(db: Executor) {
  const list = await db.select().from(classTypes).where(isNull(classTypes.archivedAt));
  const filled: string[] = [];
  for (const ct of list) {
    const tpl = templateFor(ct);
    if (!tpl) continue;
    await db.update(classTypes).set({ description: tpl.description, keywords: tpl.keywords }).where(eq(classTypes.id, ct.id));
    filled.push(ct.name);
  }
  return filled;
}
