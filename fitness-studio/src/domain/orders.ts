import { isMember } from "./massages";
import { and, desc, eq, inArray, ne } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import {
  bookings,
  classSessions,
  classTypes,
  entitlements,
  massageBookings,
  orders,
  products,
  type Order,
  type Product,
} from "@/db/schema";
import { UserError } from "@/lib/errors";
import { formatDay, formatTime } from "@/lib/dates";
import { occupancy } from "./booking";
import { changeCredits, extendCreditValidity } from "./wallet";

const DAY = 86_400_000;

export async function createProductOrder(
  db: Executor,
  input: { userId: string; productId: string },
  now = new Date(),
) {
  const [p] = await db
    .select()
    .from(products)
    .where(eq(products.id, input.productId));
  if (!p || !p.isActive) throw new UserError("Produkt není v nabídce.");
  if (p.membersOnly && !(await isMember(db, input.userId, now)))
    throw new UserError("Tenhle produkt je jen pro členy. Zastav se na recepci nebo si pořiď členství.");
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

/** Creates whatever the purchased product grants. */
async function grantProduct(
  tx: Executor,
  order: Order,
  p: Product,
  now: Date,
  periodEnd?: Date,
) {
  switch (p.kind) {
    case "credit_pack":
      await changeCredits(tx, {
        userId: order.userId,
        delta: p.credits ?? 0,
        reason: "purchase",
        orderId: order.id,
        note: p.name,
      });
      if (p.validityDays) await extendCreditValidity(tx, order.userId, p.validityDays, now);
      return;
    case "pass":
    case "membership":
    case "solarium":
    case "massage_pass":
      await tx.insert(entitlements).values({
        userId: order.userId,
        kind: p.kind,
        productId: p.id,
        orderId: order.id,
        name: p.name,
        entriesTotal: p.entries,
        weeklyLimit: p.kind === "membership" ? p.weeklyLimit : null,
        massageServiceId: p.kind === "massage_pass" ? p.massageServiceId : null,
        validFrom: now,
        validUntil:
          periodEnd ?? new Date(now.getTime() + (p.validityDays ?? 30) * DAY),
        subscriptionId: order.subscriptionId,
      });
      return;
  }
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
    if (order.status === "paid") return { order, alreadyPaid: true };

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
      await grantProduct(tx, paid, p, now, input.periodEnd ?? undefined);
    }

    if (paid.kind === "drop_in") await confirmDropIn(tx, paid, now);
    if (paid.kind === "surcharge" && paid.bookingId)
      await tx.update(bookings).set({ surchargePaidAt: now }).where(eq(bookings.id, paid.bookingId));
    if (paid.kind === "massage" && paid.massageBookingId)
      await tx.update(massageBookings).set({ paidAt: now }).where(eq(massageBookings.id, paid.massageBookingId));
    return { order: paid, alreadyPaid: false };
  });
}

async function confirmDropIn(tx: Executor, order: Order, now: Date) {
  const [b] = await tx
    .select()
    .from(bookings)
    .where(eq(bookings.orderId, order.id))
    .for("update");
  if (!b) return;
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
    return;
  }
  if (b.status !== "cancelled") return;

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
  } else {
    await changeCredits(tx, {
      userId: b.userId,
      delta: s.creditCost * b.seats,
      reason: "refund",
      orderId: order.id,
      note: "Platba dorazila po vypršení rezervace – vráceno jako kredit",
    });
  }
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
    if (!prev) return null; // first period is delivered by the checkout itself

    const [order] = await tx
      .insert(orders)
      .values({
        userId: prev.userId,
        kind: "renewal",
        productId: prev.productId,
        description: `${prev.name} – obnovení`,
        amount: input.amount,
        status: "paid",
        provider: input.provider,
        providerRef: input.invoiceId,
        subscriptionId: input.subscriptionId,
        paidAt: new Date(),
      })
      .returning();
    const [ent] = await tx
      .insert(entitlements)
      .values({
        userId: prev.userId,
        kind: prev.kind,
        productId: prev.productId,
        orderId: order.id,
        name: prev.name,
        entriesTotal: prev.entriesTotal,
        weeklyLimit: prev.weeklyLimit,
        validFrom: input.periodStart,
        validUntil: input.periodEnd,
        subscriptionId: input.subscriptionId,
      })
      .returning();
    return ent;
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
      .where(and(eq(orders.id, orderId), eq(orders.status, "pending")))
      .returning();
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

/** Member surcharge (Reformer, Individuál) paid online – by card or bank transfer. */
export async function createSurchargeOrder(db: Executor, input: { userId: string; bookingId: string }) {
  const [row] = await db
    .select({ b: bookings, s: classSessions, typeName: classTypes.name })
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

/** Reception sale – cash or card terminal, delivered immediately. */
export async function sellAtReception(
  db: DB,
  input: { userId: string; productId: string },
  now = new Date(),
) {
  const { order } = await createProductOrder(db, input, now);
  return fulfillOrder(db, { orderId: order.id, provider: "reception" }, now);
}

