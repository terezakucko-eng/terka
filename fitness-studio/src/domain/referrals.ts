import { and, asc, eq, isNotNull, isNull } from "drizzle-orm";
import type { Executor } from "@/db";
import { entitlements, referrals, users } from "@/db/schema";
import { displayName } from "@/lib/profile";
import { getSettings } from "@/lib/settings";

const DAY = 86_400_000;

/**
 * Pozvi kamarádku: every client has a personal invite link. A friend who
 * signs up through it gets the usual welcome lesson; once she pays for
 * something for the first time, the one who invited her gets a free lesson.
 */

export const isReferralCode = (code: string) => /^[0-9a-f]{10}$/.test(code);

/** Who invites through this code (shown on the invite page). */
export async function referrerByCode(db: Executor, code: string) {
  if (!isReferralCode(code)) return null;
  const [u] = await db
    .select({ id: users.id, name: users.name, nickname: users.nickname })
    .from(users)
    .where(and(eq(users.referralCode, code), isNull(users.deletedAt)));
  return u ? { id: u.id, name: displayName(u) } : null;
}

/** A new client signed up through an invite. */
export async function linkReferral(db: Executor, friendId: string, code: string) {
  const referrer = await referrerByCode(db, code);
  if (!referrer || referrer.id === friendId) return false;
  const rows = await db.insert(referrals).values({ referrerId: referrer.id, friendId }).onConflictDoNothing().returning();
  return rows.length > 0;
}

/**
 * A paid order: if it's the first payment of an invited friend, the one who
 * invited her gets her free lesson. Runs inside the payment's transaction.
 */
export async function rewardReferral(tx: Executor, friendId: string, now = new Date()) {
  const [r] = await tx
    .select()
    .from(referrals)
    .where(and(eq(referrals.friendId, friendId), isNull(referrals.rewardedAt)))
    .for("update");
  if (!r) return null;
  const cfg = await getSettings(tx);
  if (cfg.referralGiftEntries <= 0) return null;
  const [friend] = await tx.select({ name: users.name, nickname: users.nickname }).from(users).where(eq(users.id, friendId));
  const [gift] = await tx
    .insert(entitlements)
    .values({
      userId: r.referrerId,
      kind: "free",
      name: "Lekce zdarma za pozvání 💛",
      entriesTotal: cfg.referralGiftEntries,
      validFrom: now,
      validUntil: new Date(now.getTime() + Math.max(1, cfg.referralGiftValidityDays) * DAY),
      note: `Za pozvání kamarádky: ${friend ? displayName(friend) : "?"}`,
    })
    .returning();
  await tx.update(referrals).set({ rewardedAt: now, rewardEntitlementId: gift.id }).where(eq(referrals.id, r.id));
  return gift;
}

/** The client's invited friends, oldest first. */
export async function myReferrals(db: Executor, referrerId: string) {
  const rows = await db
    .select({ r: referrals, name: users.name, nickname: users.nickname, deletedAt: users.deletedAt })
    .from(referrals)
    .innerJoin(users, eq(referrals.friendId, users.id))
    .where(eq(referrals.referrerId, referrerId))
    .orderBy(asc(referrals.createdAt));
  return rows.map((x) => ({ id: x.r.id, name: x.deletedAt ? "Smazaný účet" : displayName(x), rewarded: !!x.r.rewardedAt }));
}

/** Rewards not yet announced to the one who invited. */
export async function unannouncedRewards(db: Executor) {
  return db
    .select({ r: referrals, until: entitlements.validUntil })
    .from(referrals)
    .leftJoin(entitlements, eq(referrals.rewardEntitlementId, entitlements.id))
    .where(and(isNotNull(referrals.rewardedAt), isNull(referrals.notifiedAt)));
}

export const markAnnounced = (db: Executor, id: string, now = new Date()) =>
  db.update(referrals).set({ notifiedAt: now }).where(eq(referrals.id, id));

/** For the admin: who invited this client and whom they invited. */
export async function referralInfo(db: Executor, userId: string) {
  const [by] = await db
    .select({ id: users.id, name: users.name })
    .from(referrals)
    .innerJoin(users, eq(referrals.referrerId, users.id))
    .where(eq(referrals.friendId, userId));
  const invited = await db
    .select({ id: users.id, name: users.name, rewardedAt: referrals.rewardedAt })
    .from(referrals)
    .innerJoin(users, eq(referrals.friendId, users.id))
    .where(eq(referrals.referrerId, userId))
    .orderBy(asc(referrals.createdAt));
  return { invitedBy: by ?? null, invited };
}
