"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";

/** The client saved the card (or said "not now") – stop showing the prompt in the account. */
export async function cardPromptDoneAction() {
  const user = await requireUser("/ucet");
  if (user.cardPromptAt) return;
  await (await getDb()).update(users).set({ cardPromptAt: new Date() }).where(eq(users.id, user.id));
  revalidatePath("/ucet");
}

/** The card picture was saved / shared from the phone. */
export async function cardSavedAction() {
  const user = await requireUser("/ucet");
  await (await getDb())
    .update(users)
    .set({ cardSavedAt: user.cardSavedAt ?? new Date(), cardPromptAt: user.cardPromptAt ?? new Date() })
    .where(eq(users.id, user.id));
}

/** The site was opened as an app from the home screen (standalone display mode). */
export async function appOpenedAction() {
  const user = await requireUser("/ucet");
  if (!user.appInstalledAt) await (await getDb()).update(users).set({ appInstalledAt: new Date() }).where(eq(users.id, user.id));
}
