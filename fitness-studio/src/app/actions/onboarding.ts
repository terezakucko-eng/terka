"use server";

import { eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import { getDb } from "@/db";
import { users } from "@/db/schema";
import { requireUser } from "@/lib/auth";

/** Newsletter and reminder e-mails, chosen in the welcome tour. */
export async function tourPreferencesAction(prefs: { marketing: boolean; reminders: boolean }) {
  const user = await requireUser("/ucet");
  await (await getDb())
    .update(users)
    .set({ marketingConsent: !!prefs.marketing, remindersOptIn: !!prefs.reminders })
    .where(eq(users.id, user.id));
}

/** Tour finished or skipped – don't show it again (on any device). */
export async function finishTourAction() {
  const user = await requireUser("/ucet");
  if (!user.onboardedAt)
    await (await getDb()).update(users).set({ onboardedAt: new Date(), cardPromptAt: user.cardPromptAt ?? new Date() }).where(eq(users.id, user.id));
  revalidatePath("/ucet");
}
