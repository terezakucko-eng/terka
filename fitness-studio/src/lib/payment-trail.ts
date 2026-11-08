import { aliasedTable, and, eq, inArray, like, or, sql, sum } from "drizzle-orm";
import type { DB } from "@/db";
import { bookings, classSessions, classTypes, creditTransactions, orders, type Booking } from "@/db/schema";
import { formatPrice } from "./money";
import { sessionNameSql } from "./session-name";

/**
 * The client card shows where every crown went: how each lesson was paid (and by which VS),
 * which lesson each payment is for and what a credit movement came from.
 */

type OrderBit = { id: string; number: number | null; provider: string; status: string; kind: string };
export type BookingPayment = { orders: OrderBit[]; surchargeFromCredit: boolean };
export type Lesson = { id: string; name: string; startsAt: Date };

/** The orders tied to each booking (its drop-in, its surcharge) and whether a surcharge was paid from credit. */
export async function bookingPayments(db: DB, bookingIds: string[]) {
  const map = new Map<string, BookingPayment>(bookingIds.map((id) => [id, { orders: [], surchargeFromCredit: false }]));
  if (!bookingIds.length) return map;
  const [rows, fromCredit] = await Promise.all([
    db
      .select({ bookingId: bookings.id, id: orders.id, number: orders.number, provider: orders.provider, status: orders.status, kind: orders.kind })
      .from(bookings)
      .innerJoin(orders, or(eq(orders.bookingId, bookings.id), eq(orders.id, bookings.orderId)))
      .where(inArray(bookings.id, bookingIds)),
    db
      .select({ bookingId: creditTransactions.bookingId })
      .from(creditTransactions)
      .where(and(inArray(creditTransactions.bookingId, bookingIds), eq(creditTransactions.reason, "booking"), like(creditTransactions.note, "Doplatek%"))),
  ]);
  for (const r of rows) map.get(r.bookingId)?.orders.push(r);
  for (const c of fromCredit) if (c.bookingId) map.get(c.bookingId)!.surchargeFromCredit = true;
  return map;
}

const how: Record<string, string> = {
  stripe: "kartou",
  transfer: "převodem",
  reception: "na recepci",
  manual: "(potvrzeno ručně)",
  test: "(test)",
};
const vsOf = (o: OrderBit) => (o.provider === "transfer" && o.number ? ` · VS ${o.number}` : "");

/**
 * How a booking's money stands, in one line: "Doplatek 100 Kč zaplacen převodem · VS 1121",
 * "Doplatek 100 Kč nezaplacen · čeká na převod VS 1145", "Zaplaceno kartou"… – null when
 * there's nothing to pay on top (membership, pass, credit without a surcharge).
 * `pendingOrderId` is the transfer still waiting, so reception can confirm it right there.
 */
export function paymentLine(
  b: Pick<Booking, "method" | "status" | "surcharge" | "surchargePaidAt">,
  p: BookingPayment | undefined,
): { text: string; paid: boolean; pendingOrderId?: string; pendingVs?: number | null } | null {
  if (b.status === "waitlist" || b.status === "cancelled") return null;
  const mine = p?.orders ?? [];
  if (b.method === "drop_in") {
    const paid = mine.find((o) => o.kind === "drop_in" && o.status === "paid");
    if (paid) return { text: `Zaplaceno ${how[paid.provider] ?? paid.provider}${vsOf(paid)}`, paid: true };
    const waiting = mine.find((o) => o.kind === "drop_in" && o.status === "pending");
    return waiting
      ? { text: `Čeká na platbu${waiting.number ? ` · VS ${waiting.number}` : ""}`, paid: false, pendingOrderId: waiting.id, pendingVs: waiting.number }
      : null;
  }
  if (b.surcharge <= 0) return null;
  const amount = `Doplatek ${formatPrice(b.surcharge)}`;
  const paid = mine.find((o) => o.kind === "surcharge" && o.status === "paid");
  if (paid) return { text: `${amount} zaplacen ${how[paid.provider] ?? paid.provider}${vsOf(paid)}`, paid: true };
  if (b.surchargePaidAt) return { text: `${amount} zaplacen ${p?.surchargeFromCredit ? "z kreditu" : "na místě"}`, paid: true };
  const waiting = mine.find((o) => o.kind === "surcharge" && o.status === "pending");
  return {
    text: `${amount} nezaplacen${waiting?.number ? ` · čeká na převod VS ${waiting.number}` : ""}`,
    paid: false,
    pendingOrderId: waiting?.id,
    pendingVs: waiting?.number,
  };
}

/** The lesson each payment is for (a drop-in's own, a surcharge's booking's) and how much of it came back as credit. */
export async function orderTrail(db: DB, orderIds: string[]) {
  const lessons = new Map<string, Lesson>();
  const credited = new Map<string, number>();
  if (!orderIds.length) return { lessons, credited };
  const surchargeBooking = aliasedTable(bookings, "surcharge_booking");
  const [rows, back] = await Promise.all([
    db
      .select({ orderId: orders.id, id: classSessions.id, startsAt: classSessions.startsAt, name: sessionNameSql })
      .from(orders)
      .leftJoin(surchargeBooking, eq(orders.bookingId, surchargeBooking.id))
      .innerJoin(classSessions, sql`${classSessions.id} = coalesce(${orders.sessionId}, ${surchargeBooking.sessionId})`)
      .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
      .where(inArray(orders.id, orderIds)),
    db
      .select({ orderId: creditTransactions.orderId, n: sum(creditTransactions.delta).mapWith(Number) })
      .from(creditTransactions)
      .where(and(inArray(creditTransactions.orderId, orderIds), eq(creditTransactions.reason, "refund")))
      .groupBy(creditTransactions.orderId),
  ]);
  for (const r of rows) lessons.set(r.orderId, { id: r.id, name: r.name, startsAt: r.startsAt });
  for (const r of back) if (r.orderId && r.n > 0) credited.set(r.orderId, r.n);
  return { lessons, credited };
}

/** What each credit movement came from: the payment's VS and the lesson. */
export async function ledgerTrail(db: DB, rows: { id: string; orderId: string | null; bookingId: string | null }[]) {
  const orderIds = [...new Set(rows.flatMap((r) => (r.orderId ? [r.orderId] : [])))];
  const bookingIds = [...new Set(rows.flatMap((r) => (r.bookingId ? [r.bookingId] : [])))];
  const [ords, places, ofOrders] = await Promise.all([
    orderIds.length ? db.select({ id: orders.id, number: orders.number }).from(orders).where(inArray(orders.id, orderIds)) : [],
    bookingIds.length
      ? db
          .select({ bookingId: bookings.id, id: classSessions.id, startsAt: classSessions.startsAt, name: sessionNameSql })
          .from(bookings)
          .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
          .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
          .where(inArray(bookings.id, bookingIds))
      : [],
    orderTrail(db, orderIds),
  ]);
  const vs = new Map(ords.map((o) => [o.id, o.number]));
  const lesson = new Map(places.map((p) => [p.bookingId, { id: p.id, name: p.name, startsAt: p.startsAt }]));
  return new Map(
    rows.map((r) => [
      r.id,
      {
        vs: r.orderId ? (vs.get(r.orderId) ?? null) : null,
        lesson: (r.bookingId && lesson.get(r.bookingId)) || (r.orderId && ofOrders.lessons.get(r.orderId)) || null,
      },
    ]),
  );
}
