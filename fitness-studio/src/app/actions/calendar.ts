"use server";

import { eq, sql } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { attempt, type FormState } from "@/lib/form";

/** A new calendar address – the old one (shared by mistake) stops working. */
export async function resetCalendarAction(): Promise<FormState> {
  const user = await requireUser("/ucet");
  const res = await attempt(async () => {
    await (await getDb())
      .update(users)
      .set({ calendarToken: sql`replace(gen_random_uuid()::text, '-', '')` })
      .where(eq(users.id, user.id));
    return "Hotovo – kalendář si přidej znovu novým odkazem, starý už nefunguje.";
  });
  revalidatePath("/ucet");
  return res;
}
