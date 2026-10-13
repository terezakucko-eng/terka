"use server";

import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { submitWish } from "@/domain/wishes";
import { requireUser } from "@/lib/auth";
import { attempt, field, type FormState } from "@/lib/form";
import { notifyNewWish } from "@/lib/notify";

/** Můj účet → Schránka: the client sends a message to the studio. */
export async function submitWishAction(_: FormState, fd: FormData): Promise<FormState> {
  const user = await requireUser("/ucet/schranka");
  const res = await attempt(async () => {
    const db = await getDb();
    const w = await submitWish(db, user, {
      kind: field.str(fd, "kind"),
      body: field.str(fd, "body"),
      allowPublic: field.str(fd, "visibility") === "public",
      anonymous: field.bool(fd, "anonymous"),
    });
    await notifyNewWish(db, w);
    return "Děkujeme! Vzkaz jsme dostali. 💌";
  });
  revalidatePath("/ucet/schranka");
  return res;
}
