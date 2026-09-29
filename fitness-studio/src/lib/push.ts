import "server-only";
import { eq, inArray } from "drizzle-orm";
import webpush from "web-push";
import { site } from "@/config/site";
import type { Executor } from "@/db";
import { pushSubscriptions, settings } from "@/db/schema";

/**
 * Web push notifications (Android / desktop browsers, iPhone once the site is
 * on the home screen). The VAPID key pair comes from VAPID_PUBLIC_KEY /
 * VAPID_PRIVATE_KEY, or is generated on first use and kept in the settings
 * table – so nothing has to be configured by hand.
 */
type Keys = { publicKey: string; privateKey: string };
const VAPID_SETTING = "vapid";
let cached: Keys | null = null;

export async function vapidKeys(db: Executor): Promise<Keys> {
  if (cached) return cached;
  if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY)
    return (cached = { publicKey: process.env.VAPID_PUBLIC_KEY, privateKey: process.env.VAPID_PRIVATE_KEY });
  const read = async () => (await db.select().from(settings).where(eq(settings.key, VAPID_SETTING)))[0]?.value as Keys | undefined;
  let keys = await read();
  if (!keys) {
    // two servers generating at once: the first insert wins, both read it back
    await db.insert(settings).values({ key: VAPID_SETTING, value: webpush.generateVAPIDKeys() }).onConflictDoNothing();
    keys = await read();
  }
  return (cached = keys!);
}

export type PushMessage = { title: string; body: string; url?: string };

/** Sends to every device of the given clients; dead subscriptions are removed. Returns devices reached. */
export async function sendPush(db: Executor, userIds: string[], msg: PushMessage) {
  if (!userIds.length) return 0;
  const subs = await db.select().from(pushSubscriptions).where(inArray(pushSubscriptions.userId, userIds));
  if (!subs.length) return 0;
  const { publicKey, privateKey } = await vapidKeys(db);
  const payload = JSON.stringify({ title: msg.title, body: msg.body, url: msg.url ?? `${site.url}/ucet` });
  let sent = 0;
  const gone: string[] = [];
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, payload, {
          vapidDetails: { subject: `mailto:${site.email}`, publicKey, privateKey },
          TTL: 60 * 60 * 12,
        });
        sent++;
      } catch (e) {
        const code = (e as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) gone.push(s.id); // unsubscribed / expired
        else console.error("[push] failed", code ?? e);
      }
    }),
  );
  if (gone.length) await db.delete(pushSubscriptions).where(inArray(pushSubscriptions.id, gone));
  return sent;
}

/** Never lets a push problem break the action that triggered it. */
export async function pushQuietly(db: Executor, userIds: string[], msg: PushMessage) {
  try {
    return await sendPush(db, userIds, msg);
  } catch (e) {
    console.error("[push] failed", e);
    return 0;
  }
}
