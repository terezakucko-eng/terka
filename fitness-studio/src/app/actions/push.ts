"use server";

import { and, eq } from "drizzle-orm";
import { headers } from "next/headers";
import { getDb } from "@/db";
import { pushSubscriptions } from "@/db/schema";
import { requireUser } from "@/lib/auth";

type Sub = { endpoint: string; keys: { p256dh: string; auth: string } };

/** Saves this device's push subscription for the signed-in client. */
export async function savePushSubscription(sub: Sub) {
  const user = await requireUser("/ucet");
  if (!/^https:\/\//.test(sub?.endpoint ?? "") || !sub.keys?.p256dh || !sub.keys?.auth) throw new Error("Neplatné přihlášení k odběru.");
  const userAgent = (await headers()).get("user-agent")?.slice(0, 300) ?? null;
  await (await getDb())
    .insert(pushSubscriptions)
    .values({ userId: user.id, endpoint: sub.endpoint, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId: user.id, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    });
}

export async function removePushSubscription(endpoint: string) {
  const user = await requireUser("/ucet");
  await (await getDb())
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, user.id)));
}
