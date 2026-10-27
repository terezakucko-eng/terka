import { isMember } from "./massages";
import { sessionNameSql } from "@/lib/session-name";
import { and, desc, eq, gt, inArray, ne } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import {
  bookings,
  classSessions,
  classTypes,
  creditTransactions,
  entitlements,
  massageBookings,
  orders,
  products,
  users,
  type Booking,
  type Order,
} from "@/db/schema";
import { UserError } from "@/lib/errors";
import { isStudent } from "@/lib/student";
import { formatDate, formatDay, formatTime } from "@/lib/dates";
import { inPresale, onSale, saleStartsLater } from "@/lib/price-list";
import { membershipFull, switchableTo } from "./membership-fees";
import { occupancy } from "./booking";
import { changeCredits, dropInCredit } from "./wallet";
import { rewardReferral } from "./referrals";
import { PRESALE_RESERVED, grantProduct } from "./grant";
import { activateVoucher } from "./vouchers";

const DAY = 86_400_000;

type PurchaseInput = { userId: string; productId: string; commitmentAccepted?: boolean; studentConfirmed?: boolean };

/** Whether the client can buy the product now; returns it. */
async function purchasable(db: Executor, input: PurchaseInput, now: Date) {
  const [p] = await db
    .select()
    .from(products)
    .where(eq(products.id, input.productId));
  if (!p || !p.isActive) throw new UserError("Produkt není v nabídce.");
  if (!onSale(p, now))
    throw new UserError(saleStartsLater(p, now) ? `Tohle je z ceníku na další rok – v prodeji od ${formatDate(p.saleFrom!)}.` : "Tohle už není v prodeji.");
  if (p.kind === "membership" && (await membershipFull(db, p, now)))
    throw new UserError(`${p.name} má omezený počet členství a teď jsou všechna obsazená. Napiš nám, dáme ti vědět, až se nějaké uvolní.`);
  if (p.kind === "membership" && p.commitmentMonths > 0 && input.commitmentAccepted === false)
    throw new UserError(`Před zaplacením prosím potvrď, že bereš na vědomí závazek na ${p.commitmentMonths} měsíců.`);
  // a member moves up in Můj účet (same membership, no new commitment) instead of buying a second one –
  // unless she can't (her membership ends before the new one starts, is without commitment or paid by card subscription)
  if (p.kind === "membership" && p.includedPerMonth > 0 && input.commitmentAccepted !== undefined && (await switchableTo(db, input.userId, now)).has(p.id))
    throw new UserError(`Členství už máš – na ${p.name} přejdeš v Můj účet, bez nového závazku.`);
  if (p.membersOnly && !(await isMember(db, input.userId, now)))
    throw new UserError("Tenhle produkt je jen pro členy. Zastav se na recepci nebo si pořiď členství.");
  // student price: bought on trust, the reception checks the ISIC later (verified students skip it)
  if (p.studentsOnly && input.studentConfirmed === false) {
    const [u] = await db.select({ studentUntil: users.studentUntil }).from(users).where(eq(users.id, input.userId));
    if (!isStudent(u, now))
      throw new UserError("Tohle je studentská cena – potvrď prosím, že studuješ. ISIC nebo potvrzení o studiu pak ukážeš ve studiu.");
  }
  return p;
}

export async function createProductOrder(
  db: Executor,
  /** commitmentAccepted: false = the client didn't tick the commitment box online (reception sales leave it out) */
  input: PurchaseInput,
  now = new Date(),
) {
  const p = await purchasable(db, input, now);
  const [order] = await db
    .insert(orders)
    .values({
      userId: input.userId,
      kind: "product",
      productId: p.id,
      description: p.name,
      amount: p.price,
      provider: "pending",
      expiresAt: new Date(now.getTime() + DAY),
    })
    .returning();
  return { order, product: p };
}

/**
 * A membership from next year's price list ordered in presale to be paid by
 * transfer: it's in her card right away (and takes its place) and paid with
 * the first monthly fee request, sent in December with everyone else's.
 */
export async function reservePresaleMembership(db: DB, input: PurchaseInput, now = new Date()) {
  return db.transaction(async (tx) => {
    // one place at a time for a limited membership
    await tx.select({ id: products.id }).from(products).where(eq(products.id, input.productId)).for("update");
    const p = await purchasable(tx, input, now);
    if (p.kind !== "membership" || !inPresale(p, now)) throw new UserError("Tohle jde zaplatit jen hned.");
    const [had] = await tx
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(and(eq(entitlements.userId, input.userId), eq(entitlements.productId, p.id), eq(entitlements.status, "active"), gt(entitlements.validUntil, now)));
    if (had) throw new UserError(`${p.name} už máš – najdeš ho v Můj účet.`);
    await grantProduct(tx, { userId: input.userId, orderId: null, note: PRESALE_RESERVED, reserved: true }, p, now);
    return p;
  });
}

/**
 * Marks an order paid and delivers it. Idempotent – payment webhooks can
 * arrive more than once, and late payments of expired orders are honoured.
 */
export async function fulfillOrder(
  db: DB,
  input: {
    orderId: string;
    provider: string;
    providerRef?: string | null;
    subscriptionId?: string | null;
    periodEnd?: Date | null;
  },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const [order] = await tx
      .select()
      .from(orders)
      .where(eq(orders.id, input.orderId))
      .for("update");
    if (!order) throw new Error(`Order ${input.orderId} not found`);
    // a second, different payment of an order already paid (two card checkouts) – the studio has to refund it
    if (order.status === "paid")
      return { order, alreadyPaid: true, duplicate: !!input.providerRef && !!order.providerRef && input.providerRef !== order.providerRef, dropIn: null, surcharge: null, massageCancelled: false };

    const [paid] = await tx
      .update(orders)
      .set({
        status: "paid",
        paidAt: now,
        provider: input.provider,
        providerRef: input.providerRef ?? order.providerRef,
        subscriptionId: input.subscriptionId ?? order.subscriptionId,
      })
      .where(eq(orders.id, order.id))
      .returning();

    if (paid.kind === "product" && paid.productId) {
      const [p] = await tx
        .select()
        .from(products)
        .where(eq(products.id, paid.productId));
      await grantProduct(tx, { userId: paid.userId, orderId: paid.id, subscriptionId: paid.subscriptionId }, p, now, input.periodEnd ?? undefined);
    }
    if (paid.kind === "voucher") await activateVoucher(tx, paid.id, now);

    // called off by the client or the studio before the money came – honoured as credit, never a booking back
    const calledOff = order.status === "cancelled";
    const dropIn = paid.kind === "drop_in" ? await confirmDropIn(tx, paid, now, calledOff) : null;
    const surcharge = paid.kind === "surcharge" ? await settleSurcharge(tx, paid) : null;
    let massageCancelled = false;
    if (paid.kind === "massage" && paid.massageBookingId) {
      const [m] = await tx.update(massageBookings).set({ paidAt: now }).where(eq(massageBookings.id, paid.massageBookingId)).returning();
      massageCancelled = !m || m.status === "cancelled";
    }
    // an invited friend's first payment thanks the one who invited her
    if (paid.amount > 0) await rewardReferral(tx, paid.userId, now);
    return { order: paid, alreadyPaid: false, duplicate: false, dropIn, surcharge, massageCancelled };
  });
}

/** A transfer for a drop-in / surcharge can still arrive after its hold ran out or it was called off – reception confirms it, it's settled as credit (or the place, if still free). */
export const paidLateOk = (o: Pick<Order, "status" | "kind">) =>
  (o.status === "expired" || o.status === "cancelled") && (o.kind === "drop_in" || o.kind === "surcharge");

/** Credits a paid order came back as (it arrived after its booking was gone) – 0 when it went where it was meant to. */
export async function creditedBack(db: DB, orderId: string) {
  const rows = await db
    .select({ delta: creditTransactions.delta })
    .from(creditTransactions)
    .where(and(eq(creditTransactions.orderId, orderId), eq(creditTransactions.reason, "refund")));
  return rows.reduce((sum, r) => sum + r.delta, 0);
}

type Settled = { userId: string; booking: Booking | null; outcome: "confirmed" | "paid" | "credited"; credit: number };

/** Money that came for something no longer there comes back as credit, 1 Kč = 1 kredit. */
async function creditBack(tx: Executor, order: Order, credit: number, note: string, booking: Booking | null): Promise<Settled> {
  if (credit > 0) await changeCredits(tx, { userId: order.userId, delta: credit, reason: "refund", orderId: order.id, note });
  return { userId: order.userId, booking, outcome: "credited", credit };
}

/** A paid surcharge: marked on the booking – or, when the booking is cancelled / no longer owes it / was paid already, back as credit. */
async function settleSurcharge(tx: Executor, order: Order): Promise<Settled> {
  const [b] = order.bookingId ? await tx.select().from(bookings).where(eq(bookings.id, order.bookingId)).for("update") : [];
  // cancelled, included after all, or paid at the desk meanwhile – nothing is owed any more
  if (!b || b.status === "cancelled" || b.surcharge === 0 || b.surchargePaidAt)
    return creditBack(tx, order, Math.round(order.amount / 100), "Doplatek už nebyl potřeba – vrácen jako kredit", b ?? null);
  await tx.update(bookings).set({ surchargePaidAt: order.paidAt }).where(eq(bookings.id, b.id));
  return { userId: order.userId, booking: b, outcome: "paid", credit: 0 };
}

/**
 * A paid drop-in: its place is confirmed now. When the hold ran out meanwhile it's
 * rebooked if there's room; called off by the client / studio, deleted, or full
 * – the money comes back as credit.
 */
async function confirmDropIn(tx: Executor, order: Order, now: Date, calledOff: boolean): Promise<Settled | null> {
  const [b] = await tx
    .select()
    .from(bookings)
    .where(eq(bookings.orderId, order.id))
    .for("update");
  if (!b) return creditBack(tx, order, Math.round(order.amount / 100), "Platba za lekci, která už neexistuje – vráceno jako kredit", null);
  const [s] = await tx
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, b.sessionId))
    .for("update");

  if (b.status === "pending_payment") {
    await tx
      .update(bookings)
      .set({ status: "confirmed" })
      .where(eq(bookings.id, b.id));
    return { userId: b.userId, booking: b, outcome: "confirmed", credit: 0 };
  }
  if (b.status !== "cancelled") return null;
  if (calledOff)
    return creditBack(tx, order, dropInCredit(order.amount, s.creditCost, b.seats), "Platba dorazila po zrušení rezervace – vráceno jako kredit", b);

  // Paid after the hold expired: rebook if there's still room, else credit.
  const [other] = await tx
    .select({ id: bookings.id })
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, b.userId),
        eq(bookings.sessionId, b.sessionId),
        ne(bookings.status, "cancelled"),
      ),
    );
  const canRebook =
    !other &&
    s.status === "scheduled" &&
    s.startsAt > now &&
    (await occupancy(tx, s.id)) + b.seats <= s.capacity;
  if (canRebook) {
    await tx
      .update(bookings)
      .set({ status: "confirmed", cancelledAt: null })
      .where(eq(bookings.id, b.id));
    return { userId: b.userId, booking: b, outcome: "confirmed", credit: 0 };
  }
  return creditBack(tx, order, dropInCredit(order.amount, s.creditCost, b.seats), "Platba dorazila po vypršení rezervace – vráceno jako kredit", b);
}

/** Monthly membership renewal from the payment provider (e.g. Stripe invoice). */
export async function renewMembership(
  db: DB,
  input: {
    provider: string;
    subscriptionId: string;
    invoiceId: string;
    amount: number;
    periodStart: Date;
    periodEnd: Date;
  },
) {
  return db.transaction(async (tx) => {
    const [dup] = await tx
      .select({ id: orders.id })
      .from(orders)
      .where(
        and(
          eq(orders.provider, input.provider),
          eq(orders.providerRef, input.invoiceId),
        ),
      );
    if (dup) return null;

    const [prev] = await tx
      .select()
      .from(entitlements)
      .where(eq(entitlements.subscriptionId, input.subscriptionId))
      .orderBy(desc(entitlements.validUntil))
      .limit(1);
    // whose subscription it is – the membership, or the checkout that started it
    const [first] = prev ? [] : await tx.select().from(orders).where(eq(orders.subscriptionId, input.subscriptionId)).limit(1);
    const userId = prev?.userId ?? first?.userId;
    if (!userId) return null;

    const [order] = await tx
      .insert(orders)
      .values({
        userId,
        kind: "renewal",
        productId: prev?.productId ?? first?.productId,
        description: `${prev?.name ?? first?.description} – obnovení`,
        amount: input.amount,
        status: "paid",
        provider: input.provider,
        providerRef: input.invoiceId,
        subscriptionId: input.subscriptionId,
        paidAt: new Date(),
      })
      .returning();
    // the money is recorded either way; a membership ended by the studio isn't brought back – reception refunds it
    if (!prev || prev.status === "cancelled") return { order, ent: null };
    const [ent] = await tx
      .insert(entitlements)
      .values({
        userId,
        kind: prev.kind,
        productId: prev.productId,
        orderId: order.id,
        name: prev.name,
        entriesTotal: prev.entriesTotal,
        weeklyLimit: prev.weeklyLimit,
        // the same membership for the next period: what's included, the fee, the limits
        classTypeId: prev.classTypeId,
        massageServiceId: prev.massageServiceId,
        monthlyFee: prev.monthlyFee,
        monthlyFeeUntil: prev.monthlyFeeUntil,
        includedClassTypeId: prev.includedClassTypeId,
        includedPerMonth: prev.includedPerMonth,
        sameDayOnly: prev.sameDayOnly,
        beforeHour: prev.beforeHour,
        validFrom: input.periodStart,
        validUntil: input.periodEnd,
        subscriptionId: input.subscriptionId,
      })
      .returning();
    return { order, ent };
  });
}

export async function markSubscriptionCancelled(db: Executor, subscriptionId: string) {
  await db
    .update(entitlements)
    .set({ renewalCancelled: true })
    .where(eq(entitlements.subscriptionId, subscriptionId));
}

/** Payment was abandoned – release the held spot right away. */
export async function abandonOrder(db: DB, orderId: string, now = new Date()) {
  await db.transaction(async (tx) => {
    const [o] = await tx
      .update(orders)
      .set({ status: "expired" })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending"), ne(orders.kind, "membership_fee")))
      .returning();
    // a membership fee stays due when the card checkout is closed – it can still be paid
    if (!o) return;
    await tx
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: now })
      .where(
        and(
          eq(bookings.orderId, o.id),
          inArray(bookings.status, ["pending_payment"]),
        ),
      );
  });
}

/**
 * The studio calls off an unpaid order (Admin → klient): it won't be paid,
 * a place held for it in a class is let go. Returns false when it's no
 * longer waiting for payment.
 */
export async function cancelOrder(db: DB, orderId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [o] = await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning();
    if (!o) return false;
    await tx
      .update(bookings)
      .set({ status: "cancelled", cancelledAt: now })
      .where(and(eq(bookings.orderId, o.id), inArray(bookings.status, ["pending_payment"])));
    return true;
  });
}

/** Reuses the client's open order for the same thing, so a retry doesn't pile up orders. */
async function openOrder(tx: Executor, where: ReturnType<typeof and>) {
  const [o] = await tx
    .select()
    .from(orders)
    .where(and(where, eq(orders.status, "pending")))
    .orderBy(desc(orders.createdAt))
    .limit(1);
  return o ?? null;
}

/** Member / pass surcharge (Reformer, brunch…) paid online – by card or bank transfer. */
export async function createSurchargeOrder(db: Executor, input: { userId: string; bookingId: string }) {
  const [row] = await db
    .select({ b: bookings, s: classSessions, typeName: sessionNameSql })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(and(eq(bookings.id, input.bookingId), eq(bookings.userId, input.userId)));
  if (!row || row.b.surcharge <= 0) throw new UserError("K téhle rezervaci se nic nedoplácí.");
  if (row.b.surchargePaidAt) throw new UserError("Doplatek už je zaplacený.");
  if (!["confirmed", "attended"].includes(row.b.status)) throw new UserError("Rezervace je zrušená.");
  const existing = await openOrder(db, and(eq(orders.kind, "surcharge"), eq(orders.bookingId, row.b.id)));
  if (existing) return existing;
  const [order] = await db
    .insert(orders)
    .values({
      userId: input.userId,
      kind: "surcharge",
      bookingId: row.b.id,
      sessionId: row.s.id,
      description: `Doplatek – ${row.typeName} ${formatDay(row.s.startsAt)} ${formatTime(row.s.startsAt)}`,
      amount: row.b.surcharge,
      provider: "pending",
    })
    .returning();
  return order;
}

/** Card payment of a massage booked online. */
export async function createMassageOrder(db: Executor, input: { userId: string; bookingId: string }) {
  const [b] = await db
    .select()
    .from(massageBookings)
    .where(and(eq(massageBookings.id, input.bookingId), eq(massageBookings.userId, input.userId)));
  if (!b || b.status === "cancelled") throw new UserError("Rezervace je zrušená.");
  if (b.paidAt || b.payment === "pass") throw new UserError("Masáž už je zaplacená.");
  const existing = await openOrder(db, and(eq(orders.kind, "massage"), eq(orders.massageBookingId, b.id)));
  if (existing) return existing;
  const [order] = await db
    .insert(orders)
    .values({
      userId: input.userId,
      kind: "massage",
      massageBookingId: b.id,
      description: `Masáž ${b.serviceName} – ${formatDay(b.startsAt)} ${formatTime(b.startsAt)}`,
      amount: b.price,
      provider: "pending",
    })
    .returning();
  return order;
}

/** Reception sale – already paid (e.g. by transfer), delivered immediately. */
export async function sellAtReception(
  db: DB,
  input: { userId: string; productId: string },
  now = new Date(),
) {
  const { order } = await createProductOrder(db, input, now);
  return fulfillOrder(db, { orderId: order.id, provider: "reception" }, now);
}

