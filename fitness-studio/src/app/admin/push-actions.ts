"use server";

import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireAdmin } from "@/lib/auth";
import { UserError } from "@/lib/errors";
import { attempt, field, type FormState } from "@/lib/form";
import { sendPush, type PushMessage } from "@/lib/push";
import { site } from "@/config/site";

function message(fd: FormData): PushMessage {
  const title = field.str(fd, "title");
  const body = field.str(fd, "body");
  if (!title || !body) throw new UserError("Vyplň nadpis i text.");
  const url = field.str(fd, "url");
  return { title: title.slice(0, 80), body: body.slice(0, 240), url: url.startsWith("/") ? `${site.url}${url}` : url || undefined };
}

/** Test: only to the admin's own devices. */
export async function pushTestAction(_: FormState, fd: FormData): Promise<FormState> {
  const admin = await requireAdmin();
  return attempt(async () => {
    const n = await sendPush(await getDb(), [admin.id], message(fd));
    if (!n) throw new UserError("Na žádném tvém zařízení nemáš upozornění zapnutá – zapni je nahoře v tomhle panelu (v telefonu).");
    return `Odesláno na ${n} zařízení. Mělo by ti za pár vteřin přijít.`;
  });
}

/** Everyone who turned notifications on. */
export async function pushAllAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  return attempt(async () => {
    const db = await getDb();
    const ids = [...new Set((await db.select({ userId: pushSubscriptions.userId }).from(pushSubscriptions)).map((r) => r.userId))];
    if (!ids.length) throw new UserError("Zatím si upozornění nikdo nezapnul.");
    const n = await sendPush(db, ids, message(fd));
    return `Odesláno ${ids.length} lidem (${n} zařízení).`;
  });
}
