"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { announcementComments, announcementReactions, announcements } from "@/db/schema";
import { MAX_COMMENT, REACTIONS } from "@/lib/board";
import { requireUser } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";

function commentBody(fd: FormData) {
  const body = field.str(fd, "body").trim();
  if (!body) throw new UserError("Napiš něco.");
  if (body.length > MAX_COMMENT) throw new UserError(`Reakce je moc dlouhá (max. ${MAX_COMMENT} znaků).`);
  return body;
}

export async function addCommentAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/nastenka");
  const res = await attempt(async () => {
    const body = commentBody(fd);
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

/** Authors can edit their own reactions, admins anyone's. */
export async function editCommentAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/nastenka");
  const res = await attempt(async () => {
    const body = commentBody(fd);
    const db = await getDb();
    const [c] = await db.select().from(announcementComments).where(eq(announcementComments.id, field.str(fd, "id")));
    if (!c) throw new UserError("Reakce nenalezena.");
    if (c.userId !== user.id && user.role !== "admin") throw new UserError("Tohle upravit nemůžeš.");
    await db.update(announcementComments).set({ body, editedAt: new Date() }).where(eq(announcementComments.id, c.id));
    return "Upraveno.";
  });
  revalidatePath("/nastenka");
  return res;
}

/** Adds or removes the user's emoji on a post. */
export async function toggleReactionAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/nastenka");
  const res = await attempt(async () => {
    const emoji = field.str(fd, "emoji");
    if (!(REACTIONS as readonly string[]).includes(emoji)) throw new UserError("Neznámá reakce.");
    const db = await getDb();
    const [a] = await db.select({ id: announcements.id }).from(announcements).where(eq(announcements.id, field.str(fd, "announcementId")));
    if (!a) throw new UserError("Příspěvek nenalezen.");
    const key = and(eq(announcementReactions.announcementId, a.id), eq(announcementReactions.userId, user.id), eq(announcementReactions.emoji, emoji));
    const removed = await db.delete(announcementReactions).where(key).returning({ e: announcementReactions.emoji });
    if (!removed.length) await db.insert(announcementReactions).values({ announcementId: a.id, userId: user.id, emoji }).onConflictDoNothing();
    return "";
  });
  revalidatePath("/nastenka");
  return res;
}
