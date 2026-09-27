"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { announcementComments, announcements } from "@/db/schema";
import { requireUser } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";

export async function addCommentAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/nastenka");
  const res = await attempt(async () => {
    const body = field.str(fd, "body").trim();
    if (!body) throw new UserError("Napiš něco.");
    if (body.length > 1000) throw new UserError("Reakce je moc dlouhá (max. 1000 znaků).");
    const db = await getDb();
    const [a] = await db.select({ id: announcements.id }).from(announcements).where(eq(announcements.id, field.str(fd, "announcementId")));
    if (!a) throw new UserError("Příspěvek nenalezen.");
    await db.insert(announcementComments).values({ announcementId: a.id, userId: user.id, body });
    return "Přidáno.";
  });
  revalidatePath("/nastenka");
  return res;
}

/** Authors can delete their own reactions, staff anyone's. */
export async function deleteCommentAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/nastenka");
  const res = await attempt(async () => {
    const db = await getDb();
    const [c] = await db.select().from(announcementComments).where(eq(announcementComments.id, field.str(fd, "id")));
    if (!c) throw new UserError("Reakce nenalezena.");
    if (c.userId !== user.id && user.role === "client") throw new UserError("Tohle smazat nemůžeš.");
    await db.delete(announcementComments).where(eq(announcementComments.id, c.id));
    return "Smazáno.";
  });
  revalidatePath("/nastenka");
  return res;
}
