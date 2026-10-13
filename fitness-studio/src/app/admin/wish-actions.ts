"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { publishWish, replyToWish, setWishResolved } from "@/domain/wishes";
import { requireAdmin } from "@/lib/auth";
import { attempt, field, type FormState } from "@/lib/form";
import { notifyWishReply } from "@/lib/notify";

const refresh = () => {
  revalidatePath("/admin/schranka");
  revalidatePath("/schranka");
};

/** Admin → Schránka: reply (the client gets it by e-mail and in the account). */
export async function replyWishAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const res = await attempt(async () => {
    const db = await getDb();
    const w = await replyToWish(db, field.str(fd, "id"), field.str(fd, "reply"));
    await notifyWishReply(db, w);
    return "Odpověď odeslána.";
  });
  refresh();
  return res;
}

export async function resolveWishAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const resolved = field.bool(fd, "resolved");
  const res = await attempt(async () => {
    await setWishResolved(await getDb(), field.str(fd, "id"), resolved);
    return resolved ? "Označeno jako vyřešené." : "Vzkaz je znovu otevřený.";
  });
  refresh();
  return res;
}

export async function publishWishAction(_: FormState, fd: FormData): Promise<FormState> {
  await requireAdmin();
  const on = field.bool(fd, "on");
  const res = await attempt(async () => {
    await publishWish(await getDb(), field.str(fd, "id"), on);
    return on ? "Zveřejněno na webu." : "Skryto z webu.";
  });
  refresh();
  return res;
}
