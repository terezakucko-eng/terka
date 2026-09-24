"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { content } from "@/db/schema";
import { SECTIONS, type SectionDef } from "@/content/definitions";
import { requireAdmin } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { storeImage, uploadedFile } from "@/lib/media";

/** Saves one section of website content (texts + image uploads). */
export async function saveContentAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    const id = field.str(fd, "section");
    const section = (SECTIONS as Record<string, SectionDef>)[id];
    if (!section) throw new UserError("Neznámá sekce.");
    const db = await getDb();
    let changed = 0;

    const set = async (key: string, value: string) => {
      await db
        .insert(content)
        .values({ key, value, updatedAt: new Date() })
        .onConflictDoUpdate({ target: content.key, set: { value, updatedAt: new Date() } });
      changed++;
    };
    const reset = async (key: string) => {
      await db.delete(content).where(eq(content.key, key));
    };

    for (const [name, def] of Object.entries(section.fields)) {
      const key = `${id}.${name}`;
      if (def.type === "image") {
        const file = uploadedFile(fd, `file_${name}`);
        if (file) await set(key, await storeImage(db, file));
        else if (field.bool(fd, `reset_${name}`)) await reset(key);
        else {
          const url = field.str(fd, `f_${name}`);
          if (url && url !== def.default) await set(key, url);
        }
        continue;
      }
      const raw = fd.get(`f_${name}`);
      if (typeof raw !== "string") continue;
      const value = raw.replace(/\r\n/g, "\n").trim();
      if (value === "" || value === def.default.trim()) await reset(key);
      else await set(key, value);
    }
    return changed ? "Uloženo – změny jsou hned vidět na webu." : "Uloženo (vše na výchozích textech).";
  });
  revalidatePath("/", "layout");
  return res;
}
