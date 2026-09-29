import { and, eq, gt, inArray, ne, sql } from "drizzle-orm";
import type { DB } from "@/db";
import {
  announcementComments,
  announcementReactions,
  bookings,
  campaignMessages,
  classSessions,
  entitlements,
  massageBookings,
  orders,
  passwordResets,
  pushSubscriptions,
  reviews,
  users,
  type Booking,
} from "@/db/schema";
import { UserError } from "@/lib/errors";
import { cancelBooking } from "./booking";
import { cancelMassage } from "./massages";
import { deleteClients } from "./cleanup";

/** What the client should know before deleting (shown next to the button). */
export async function deletionCheck(db: DB, userId: string, now = new Date()) {
  const [membership] = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.status, "active"),
        gt(entitlements.validUntil, now),
        // a membership, or anything still renewing by card
        sql`(${entitlements.kind} = 'membership' or (${entitlements.subscriptionId} is not null and not ${entitlements.renewalCancelled}))`,
      ),
    )
    .limit(1);
  const [unpaidFee] = await db
    .select({ id: orders.id })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee"), eq(orders.status, "pending")))
    .limit(1);
  const [upcoming] = await db
    .select({ n: sql<number>`count(*)::int` })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, ["confirmed", "waitlist", "pending_payment"]),
        gt(classSessions.startsAt, now),
      ),
    );
  const blocker = membership
    ? "Máš aktivní členství nebo předplatné kartou. Členství je závazné – napiš nám prosím a ukončení domluvíme, pak si účet smazat můžeš."
    : unpaidFee
      ? "Máš nezaplacený členský příspěvek. Nejdřív ho prosím uhraď nebo se nám ozvi."
      : null;
  return { blocker, upcomingBookings: upcoming?.n ?? 0 };
}

/**
 * The client deletes their own account. Upcoming classes and massages are
 * cancelled (freed places go to the waitlist). Without any payment history the
 * account disappears completely; otherwise the payments must stay for the
 * accounts, so the person is anonymised instead: name, e-mail, phone, photo,
 * birthday, consents and board posts are gone and nobody can sign in again.
 */
export async function deleteOwnAccount(db: DB, userId: string, now = new Date()) {
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u || u.deletedAt) throw new UserError("Účet nenalezen.");
  if (u.role !== "client") throw new UserError("Účet studia se takhle smazat nedá.");
  const { blocker } = await deletionCheck(db, userId, now);
  if (blocker) throw new UserError(blocker);

  const promoted: Pick<Booking, "userId" | "sessionId">[] = [];
  const future = await db
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, ["confirmed", "waitlist", "pending_payment"]),
        gt(classSessions.startsAt, now),
      ),
    );
  for (const b of future) {
    // as the studio would: no storno limit, nothing to give back to a deleted account
    const r = await cancelBooking(db, { bookingId: b.id, actorId: userId, isAdmin: true, refund: false }, now);
    promoted.push(...r.promoted);
  }
  const massages = await db
    .select({ id: massageBookings.id })
    .from(massageBookings)
    .where(and(eq(massageBookings.userId, userId), eq(massageBookings.status, "confirmed"), gt(massageBookings.startsAt, now)));
  for (const m of massages) await cancelMassage(db, { bookingId: m.id, actorId: userId, staff: true }, now);

  const [paid] = await db.select({ id: orders.id }).from(orders).where(eq(orders.userId, userId)).limit(1);
  if (!paid) {
    // a review would otherwise stay behind under the author's name
    await db.delete(reviews).where(eq(reviews.userId, userId));
    await deleteClients(db, { ids: [userId] });
    return { user: u, promoted, anonymised: false };
  }

  await db.transaction(async (tx) => {
    await tx.delete(passwordResets).where(eq(passwordResets.userId, userId));
    await tx.delete(pushSubscriptions).where(eq(pushSubscriptions.userId, userId));
    await tx.delete(announcementComments).where(eq(announcementComments.userId, userId));
    await tx.delete(announcementReactions).where(eq(announcementReactions.userId, userId));
    await tx.delete(campaignMessages).where(eq(campaignMessages.userId, userId));
    await tx.delete(reviews).where(eq(reviews.userId, userId));
    await tx
      .update(entitlements)
      .set({ status: "cancelled" })
      .where(and(eq(entitlements.userId, userId), ne(entitlements.status, "cancelled")));
    await tx
      .update(users)
      .set({
        email: `smazany-${u.id}@octopush.invalid`,
        name: "Smazaný účet",
        phone: null,
        // no bcrypt hash matches this – the account can't be signed into
        passwordHash: "!deleted",
        avatar: null,
        nickname: null,
        birthDate: null,
        nameDay: null,
        healthConfirmedAt: null,
        marketingConsent: false,
        smsConsent: false,
        whatsappConsent: false,
        remindersOptIn: false,
        bookingEmails: false,
        creditBalance: 0,
        creditExpiresAt: null,
        stripeCustomerId: null,
        importedAt: null,
        adminNote: null,
        deletedAt: now,
      })
      .where(eq(users.id, userId));
  });
  return { user: u, promoted, anonymised: true };
}
