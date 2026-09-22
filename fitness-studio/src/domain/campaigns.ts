import { and, eq, exists, gt, gte, inArray, isNotNull, lt, lte, ne, notExists, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import {
  bookings,
  campaignMessages,
  campaigns,
  classSessions,
  entitlements,
  users,
  type Audience,
  type Campaign,
} from "@/db/schema";
import { UserError } from "@/lib/errors";

const DAY = 86_400_000;

export type Channel = Campaign["channel"];
export type Purpose = "marketing" | "service";

export const segmentLabel: Record<Audience["segment"], string> = {
  all: "Všichni klienti",
  members: "Aktivní členové",
  passes: "Držitelé platné permanentky",
  inactive: "Neaktivní (bez lekce X dní)",
  new: "Noví (registrace za posledních X dní)",
  class_type: "Chodí na typ lekce (posledních X dní)",
  session: "Přihlášení na konkrétní termín",
};

/** SQL condition selecting the clients in a segment. */
function segmentWhere(a: Audience, now: Date) {
  const days = Math.max(1, a.days ?? 30);
  const since = new Date(now.getTime() - days * DAY);
  const activeEnt = (kind: "membership" | "pass", tx: Executor) =>
    exists(
      tx
        .select({ x: sql`1` })
        .from(entitlements)
        .where(
          and(
            eq(entitlements.userId, users.id),
            eq(entitlements.kind, kind),
            eq(entitlements.status, "active"),
            lte(entitlements.validFrom, now),
            gt(entitlements.validUntil, now),
            kind === "pass"
              ? sql`(${entitlements.entriesTotal} is null or ${entitlements.entriesUsed} < ${entitlements.entriesTotal})`
              : undefined,
          ),
        ),
    );
  const booked = (tx: Executor, extra: ReturnType<typeof and>) =>
    tx
      .select({ x: sql`1` })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(and(eq(bookings.userId, users.id), extra));

  return (tx: Executor) => {
    switch (a.segment) {
      case "all":
        return undefined;
      case "members":
        return activeEnt("membership", tx);
      case "passes":
        return activeEnt("pass", tx);
      case "new":
        return gte(users.createdAt, since);
      case "inactive":
        return and(
          lt(users.createdAt, since),
          notExists(
            booked(
              tx,
              and(
                inArray(bookings.status, ["confirmed", "attended"]),
                gte(classSessions.startsAt, since),
              ),
            ),
          ),
        );
      case "class_type":
        if (!a.classTypeId) throw new UserError("Vyber typ lekce.");
        return exists(
          booked(
            tx,
            and(
              eq(classSessions.classTypeId, a.classTypeId),
              inArray(bookings.status, ["confirmed", "attended"]),
              gte(classSessions.startsAt, since),
            ),
          ),
        );
      case "session":
        if (!a.sessionId) throw new UserError("Vyber termín lekce.");
        return exists(
          booked(tx, and(eq(bookings.sessionId, a.sessionId), ne(bookings.status, "cancelled"))),
        );
    }
  };
}

/**
 * Recipients of a campaign. Marketing needs the channel's consent;
 * service messages (e.g. "dnes je zavřeno") go to everyone in the segment –
 * except WhatsApp, where Meta always requires an opt-in.
 */
export async function audienceRecipients(
  db: Executor,
  c: Pick<Campaign, "channel" | "audience" | "purpose">,
  now = new Date(),
) {
  const consent =
    c.channel === "whatsapp"
      ? eq(users.whatsappConsent, true)
      : c.purpose === "service"
        ? undefined
        : c.channel === "sms"
          ? eq(users.smsConsent, true)
          : eq(users.marketingConsent, true);
  const contact = c.channel === "email" ? undefined : isNotNull(users.phone);

  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      phone: users.phone,
      creditBalance: users.creditBalance,
      unsubscribeToken: users.unsubscribeToken,
    })
    .from(users)
    .where(and(eq(users.role, "client"), consent, contact, segmentWhere(c.audience, now)(db)))
    .orderBy(users.name);
}

export type Recipient = Awaited<ReturnType<typeof audienceRecipients>>[number];

/** Replaces {{jmeno}}, {{cele_jmeno}}, {{kredit}}, {{odhlasit}}. */
export function personalize(text: string, r: Recipient, unsubscribeUrl: string) {
  const first = r.name.trim().split(/\s+/)[0] ?? "";
  return text
    .replaceAll("{{jmeno}}", first)
    .replaceAll("{{cele_jmeno}}", r.name)
    .replaceAll("{{kredit}}", String(r.creditBalance))
    .replaceAll("{{odhlasit}}", unsubscribeUrl);
}

/** Queues one message per recipient and switches the campaign to sending. */
export async function startCampaign(db: DB, campaignId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [c] = await tx
      .select()
      .from(campaigns)
      .where(eq(campaigns.id, campaignId))
      .for("update");
    if (!c) throw new UserError("Kampaň neexistuje.");
    if (c.status !== "draft") throw new UserError("Kampaň už byla odeslána.");
    if (c.channel === "email" && (!c.subject || !c.body.trim()))
      throw new UserError("Vyplň předmět a text e-mailu.");
    if (c.channel === "sms" && !c.body.trim()) throw new UserError("Vyplň text SMS.");
    if (c.channel === "whatsapp" && !c.waTemplate)
      throw new UserError("Vyplň název schválené WhatsApp šablony.");

    const list = await audienceRecipients(tx, c, now);
    if (!list.length) throw new UserError("Cílová skupina je prázdná.");
    await tx.insert(campaignMessages).values(
      list.map((r) => ({
        campaignId: c.id,
        userId: r.id,
        to: c.channel === "email" ? r.email : r.phone!,
      })),
    );
    const [updated] = await tx
      .update(campaigns)
      .set({ status: "sending", recipientCount: list.length })
      .where(eq(campaigns.id, c.id))
      .returning();
    return updated;
  });
}

export type Sender = {
  email: (
    msgs: { to: string; r: Recipient; unsubscribeUrl: string }[],
  ) => Promise<({ ok: true; ref?: string } | { ok: false; error: string })[]>;
  single: (
    to: string,
    r: Recipient,
    unsubscribeUrl: string,
  ) => Promise<{ ok: true; ref?: string } | { ok: false; error: string }>;
};

/**
 * Sends the next batch of queued messages. Call repeatedly until `remaining`
 * is 0 – keeps each request short enough for serverless time limits.
 */
export async function processCampaign(
  db: DB,
  campaignId: string,
  sender: Sender,
  unsubscribeUrlFor: (token: string) => string,
  batchSize = 50,
) {
  return db.transaction(async (tx) => {
    const [c] = await tx.select().from(campaigns).where(eq(campaigns.id, campaignId));
    if (!c || c.status !== "sending") return { remaining: 0, sent: 0, failed: 0 };

    const rows = await tx
      .select({ m: campaignMessages, u: users })
      .from(campaignMessages)
      .innerJoin(users, eq(campaignMessages.userId, users.id))
      .where(and(eq(campaignMessages.campaignId, c.id), eq(campaignMessages.status, "queued")))
      .limit(batchSize)
      .for("update", { of: campaignMessages, skipLocked: true });

    const items = rows.map(({ m, u }) => ({
      m,
      r: {
        id: u.id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        creditBalance: u.creditBalance,
        unsubscribeToken: u.unsubscribeToken,
      },
      unsubscribeUrl: unsubscribeUrlFor(u.unsubscribeToken),
    }));

    const results =
      c.channel === "email"
        ? await sender.email(items.map((i) => ({ to: i.m.to, r: i.r, unsubscribeUrl: i.unsubscribeUrl })))
        : await Promise.all(items.map((i) => sender.single(i.m.to, i.r, i.unsubscribeUrl)));

    let sent = 0;
    let failed = 0;
    const now = new Date();
    for (const [idx, res] of results.entries()) {
      const id = items[idx].m.id;
      if (res.ok) {
        sent++;
        await tx
          .update(campaignMessages)
          .set({ status: "sent", providerRef: res.ref ?? null, sentAt: now })
          .where(eq(campaignMessages.id, id));
      } else {
        failed++;
        await tx
          .update(campaignMessages)
          .set({ status: "failed", error: res.error })
          .where(eq(campaignMessages.id, id));
      }
    }

    const [{ n: remaining }] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(campaignMessages)
      .where(and(eq(campaignMessages.campaignId, c.id), eq(campaignMessages.status, "queued")));

    await tx
      .update(campaigns)
      .set({
        sentCount: sql`${campaigns.sentCount} + ${sent}`,
        failedCount: sql`${campaigns.failedCount} + ${failed}`,
        ...(remaining === 0 ? { status: "sent" as const, sentAt: now } : {}),
      })
      .where(eq(campaigns.id, c.id));
    return { remaining, sent, failed };
  });
}

/** Unsubscribe via token from a newsletter / SMS link (no login needed). */
export async function unsubscribe(
  db: Executor,
  token: string,
  channels: Channel[] = ["email", "sms", "whatsapp"],
) {
  const [u] = await db
    .update(users)
    .set({
      ...(channels.includes("email") ? { marketingConsent: false } : {}),
      ...(channels.includes("sms") ? { smsConsent: false } : {}),
      ...(channels.includes("whatsapp") ? { whatsappConsent: false } : {}),
    })
    .where(eq(users.unsubscribeToken, token))
    .returning({ id: users.id });
  return !!u;
}
