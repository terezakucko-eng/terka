import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, classTypes, orders, users } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking } from "@/domain/booking";
import { createSurchargeOrder, creditedBack, fulfillOrder, paidLateOk } from "@/domain/orders";
import { deleteOrder } from "@/domain/cleanup";
import { grantEntitlement } from "@/domain/users";
import { changeCredits, dropInCredit } from "@/domain/wallet";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const userOf = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0];
const bookingOf = async (id: string) => (await h.db.select().from(bookings).where(eq(bookings.id, id)))[0];
const pay = (orderId: string, ref = `cs_${orderId}`) => fulfillOrder(h.db, { orderId, provider: "stripe", providerRef: ref }, NOW);

/** A 250 Kč drop-in on a class worth 250 credits (1 Kč = 1 kredit in the studio). */
async function dropIn(over: { amount?: number; creditCost?: number } = {}) {
  const s = await makeSession(h.db, { creditCost: over.creditCost ?? 250 });
  const u = await makeUser(h.db);
  const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
  if (over.amount !== undefined) await h.db.update(orders).set({ amount: over.amount }).where(eq(orders.id, order!.id));
  return { s, u, booking, order: order! };
}

describe("a paid drop-in cancelled in time comes back as what was paid", () => {
  it("the full price → the class's credits", async () => {
    const { u, booking, order } = await dropIn();
    await pay(order.id);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect((await userOf(u.id)).creditBalance).toBe(250);
  });

  it("a cheaper first visit → only what was paid", async () => {
    const { u, booking, order } = await dropIn({ amount: 15000 });
    await pay(order.id);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect((await userOf(u.id)).creditBalance).toBe(150);
  });

  it("never more than the class is worth", () => {
    expect(dropInCredit(30000, 250, 1)).toBe(250);
    expect(dropInCredit(45000, 250, 2)).toBe(450);
    expect(dropInCredit(0, 250, 1)).toBe(0);
  });
});

describe("money that comes after the booking is gone", () => {
  it("a transfer paid after the client cancelled → credit, the place isn't taken back", async () => {
    const { u, booking, order } = await dropIn();
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect((await h.db.select().from(orders).where(eq(orders.id, order.id)))[0].status).toBe("cancelled");
    const r = await pay(order.id);
    expect(r.dropIn).toMatchObject({ outcome: "credited", credit: 250 });
    expect((await bookingOf(booking.id)).status).toBe("cancelled");
    expect((await userOf(u.id)).creditBalance).toBe(250);
    // the client's payment page says so too
    expect(await creditedBack(h.db, order.id)).toBe(250);
  });

  it("reception may confirm only a late drop-in / surcharge transfer, not any called-off order", () => {
    expect(paidLateOk({ status: "expired", kind: "drop_in" })).toBe(true);
    expect(paidLateOk({ status: "cancelled", kind: "surcharge" })).toBe(true);
    expect(paidLateOk({ status: "cancelled", kind: "product" })).toBe(false);
    expect(paidLateOk({ status: "pending", kind: "drop_in" })).toBe(false);
  });

  it("a payment for a booking that was deleted → the whole amount as credit", async () => {
    const { u, booking, order } = await dropIn();
    await h.db.delete(bookings).where(eq(bookings.id, booking.id));
    const r = await pay(order.id);
    expect(r.dropIn).toMatchObject({ outcome: "credited", credit: 250, booking: null });
    expect((await userOf(u.id)).creditBalance).toBe(250);
  });

  it("a surcharge paid after the booking was cancelled → credit", async () => {
    const s = await makeSession(h.db);
    await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const opt = (await bookingOptions(h.db, u.id, s)).find((o) => o.method === "membership")!;
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: opt.entitlementId }, NOW);
    const order = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    // the checkout was opened before the cancel, paid after it
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    const r = await pay(order.id);
    expect(r.surcharge).toMatchObject({ outcome: "credited", credit: 100 });
    expect((await bookingOf(booking.id)).surchargePaidAt).toBeNull();
    expect((await userOf(u.id)).creditBalance).toBe(100);
  });
});

describe("paid twice", () => {
  it("a second, different card payment is flagged for the studio to refund", async () => {
    const { order } = await dropIn();
    expect((await pay(order.id, "cs_one")).duplicate).toBe(false);
    expect((await pay(order.id, "cs_one")).duplicate).toBe(false);
    const again = await pay(order.id, "cs_two");
    expect(again).toMatchObject({ alreadyPaid: true, duplicate: true });
  });
});

describe("credit given back doesn't vanish with an expiring balance", () => {
  it("a refund keeps the credit valid at least 60 days", async () => {
    const u = await makeUser(h.db);
    const soon = new Date(Date.now() + 3 * 86_400_000);
    await h.db.update(users).set({ creditExpiresAt: soon }).where(eq(users.id, u.id));
    await h.db.transaction((tx) => changeCredits(tx, { userId: u.id, delta: 100, reason: "refund", note: "storno" }));
    expect(+(await userOf(u.id)).creditExpiresAt!).toBeGreaterThan(Date.now() + 59 * 86_400_000);
  });

  it("a later expiry and credit with no expiry stay as they are", async () => {
    const u = await makeUser(h.db);
    const later = new Date(Date.now() + 200 * 86_400_000);
    await h.db.update(users).set({ creditExpiresAt: later }).where(eq(users.id, u.id));
    await h.db.transaction((tx) => changeCredits(tx, { userId: u.id, delta: 100, reason: "refund" }));
    expect((await userOf(u.id)).creditExpiresAt).toEqual(later);
    const v = await makeUser(h.db);
    await h.db.transaction((tx) => changeCredits(tx, { userId: v.id, delta: 100, reason: "refund" }));
    expect((await userOf(v.id)).creditExpiresAt).toBeNull();
  });
});

describe("a lapsed transfer paid late", () => {
  it("gets the place back when there's room", async () => {
    const { u, booking, order } = await dropIn();
    await h.db.update(orders).set({ status: "expired" }).where(eq(orders.id, order.id));
    await h.db.update(bookings).set({ status: "cancelled", cancelledAt: hours(48) }).where(eq(bookings.id, booking.id));
    const r = await pay(order.id);
    expect(r.dropIn).toMatchObject({ outcome: "confirmed" });
    expect((await bookingOf(booking.id)).status).toBe("confirmed");
    expect((await userOf(u.id)).creditBalance).toBe(0);
  });
});

describe("deleting an order takes back what it paid for", () => {
  it("an upcoming drop-in place is let go", async () => {
    const admin = await makeUser(h.db);
    const { s, booking, order } = await dropIn();
    await pay(order.id);
    expect(await deleteOrder(h.db, order.id, admin.id, NOW)).toEqual([s.id]);
    expect((await bookingOf(booking.id)).status).toBe("cancelled");
  });

  it("a paid surcharge is owed again", async () => {
    const admin = await makeUser(h.db);
    const s = await makeSession(h.db);
    await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const opt = (await bookingOptions(h.db, u.id, s)).find((o) => o.method === "membership")!;
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: opt.entitlementId }, NOW);
    const order = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    await pay(order.id);
    expect((await bookingOf(booking.id)).surchargePaidAt).not.toBeNull();
    await deleteOrder(h.db, order.id, admin.id, NOW);
    expect((await bookingOf(booking.id)).surchargePaidAt).toBeNull();
    expect((await bookingOf(booking.id)).status).toBe("confirmed");
  });
});
