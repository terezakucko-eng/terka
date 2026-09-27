import { and, eq, gte, inArray, isNotNull, lt } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import {
  bookings,
  classSessions,
  creditTransactions,
  entitlements,
  massageBookings,
  orders,
  users,
} from "@/db/schema";
import { UserError } from "@/lib/errors";
import { changeCredits } from "./wallet";

/**
 * Removes an order as if it never happened (test sale, mistake at reception):
 * what it granted is taken back – passes/memberships disappear, bought credit
 * is deducted (never below zero) – and it no longer counts in revenue.
 * Money itself is not moved; card refunds go through Stripe.
 */
async function removeOrder(tx: Executor, orderId: string, actorId: string) {
  const [o] = await tx.select().from(orders).where(eq(orders.id, orderId)).for("update");
  if (!o) return false;

  await tx.delete(entitlements).where(eq(entitlements.orderId, o.id));

  const txs = await tx.select().from(creditTransactions).where(eq(creditTransactions.orderId, o.id));
  const granted = txs.reduce((n, t) => n + t.delta, 0);
  await tx.update(creditTransactions).set({ orderId: null }).where(eq(creditTransactions.orderId, o.id));
  if (granted > 0) {
    const [u] = await tx.select({ balance: users.creditBalance }).from(users).where(eq(users.id, o.userId));
    const take = Math.min(granted, u?.balance ?? 0);
    if (take > 0)
      await changeCredits(tx, {
        userId: o.userId,
        delta: -take,
        reason: "admin",
        note: `Smazaná objednávka č. ${o.number}`,
        createdBy: actorId,
      });
  }

  await tx.update(bookings).set({ orderId: null }).where(eq(bookings.orderId, o.id));
  await tx.delete(orders).where(eq(orders.id, o.id));
  return true;
}

export async function deleteOrder(db: DB, orderId: string, actorId: string) {
  return db.transaction(async (tx) => {
    if (!(await removeOrder(tx, orderId, actorId))) throw new UserError("Objednávka nenalezena.");
  });
}

/** Studio launch: wipe test/reception sales in one go. */
export async function deleteOrders(
  db: DB,
  opts: { providers: string[]; before: Date; actorId: string },
) {
  if (!opts.providers.length) throw new UserError("Vyber, které platby smazat.");
  return db.transaction(async (tx) => {
    const list = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(and(inArray(orders.provider, opts.providers), lt(orders.createdAt, opts.before)));
    for (const o of list) await removeOrder(tx, o.id, opts.actorId);
    return list.length;
  });
}

/**
 * Deletes a client with everything attached (bookings, passes, credit,
 * orders, massages, messages). Staff accounts must be demoted first.
 */
export async function deleteClient(db: DB, userId: string, actorId: string) {
  if (userId === actorId) throw new UserError("Sama sebe smazat nemůžeš.");
  const [u] = await db.select().from(users).where(eq(users.id, userId));
  if (!u) throw new UserError("Klient nenalezen.");
  if (u.role !== "client")
    throw new UserError("Tohle je účet lektora nebo admina. Nejdřív mu změň roli na klienta.");
  await deleteClients(db, { ids: [u.id] });
  return u;
}

/**
 * Bulk version: the given clients, or every client account (optionally only
 * the imported ones). Staff and admin accounts are never touched.
 */
export async function deleteClients(
  db: DB,
  opts: { ids?: string[]; all?: boolean; importedOnly?: boolean },
) {
  return db.transaction(async (tx) => {
    const rows = await tx
      .select({ id: users.id })
      .from(users)
      .where(
        and(
          eq(users.role, "client"),
          opts.all ? undefined : inArray(users.id, opts.ids?.length ? opts.ids : [NONE]),
          opts.importedOnly ? isNotNull(users.importedAt) : undefined,
        ),
      );
    const ids = rows.map((r) => r.id);
    for (let i = 0; i < ids.length; i += 500) {
      const part = ids.slice(i, i + 500);
      // credit history points at bookings and orders – remove it first
      await tx.delete(creditTransactions).where(inArray(creditTransactions.userId, part));
      await tx.delete(massageBookings).where(inArray(massageBookings.userId, part));
      await tx.delete(bookings).where(inArray(bookings.userId, part));
      await tx.delete(entitlements).where(inArray(entitlements.userId, part));
      await tx.delete(orders).where(inArray(orders.userId, part));
      await tx.delete(users).where(inArray(users.id, part));
    }
    return ids.length;
  });
}

const NONE = "00000000-0000-0000-0000-000000000000";

/**
 * Removes a class from the schedule for good. Upcoming classes are cancelled
 * first (clients get their entry/credit back – the caller sends the e-mails);
 * past ones are simply removed together with their attendance.
 */
export async function purgeSession(db: DB, sessionId: string) {
  await db.transaction(async (tx) => {
    const ids = (
      await tx.select({ id: bookings.id }).from(bookings).where(eq(bookings.sessionId, sessionId))
    ).map((b) => b.id);
    if (ids.length) {
      await tx.update(creditTransactions).set({ bookingId: null }).where(inArray(creditTransactions.bookingId, ids));
      await tx.delete(bookings).where(inArray(bookings.id, ids));
    }
    await tx.update(orders).set({ sessionId: null }).where(eq(orders.sessionId, sessionId));
    await tx.delete(classSessions).where(eq(classSessions.id, sessionId));
  });
}

/** This class and the later ones of the same weekly series. */
export async function seriesFrom(db: Executor, sessionId: string) {
  const [s] = await db.select().from(classSessions).where(eq(classSessions.id, sessionId));
  if (!s) return [];
  if (!s.seriesId) return [s];
  return db
    .select()
    .from(classSessions)
    .where(and(eq(classSessions.seriesId, s.seriesId), gte(classSessions.startsAt, s.startsAt)));
}
