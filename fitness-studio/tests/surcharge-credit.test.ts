import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classTypes, creditTransactions, orders, users } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking, paySurchargeWithCredits, unpaidBookings } from "@/domain/booking";
import { createSurchargeOrder, fulfillOrder } from "@/domain/orders";
import { grantEntitlement } from "@/domain/users";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const userOf = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0];
const bookingOf = async (id: string) => (await h.db.select().from(bookings).where(eq(bookings.id, id)))[0];
const orderOf = async (id: string) => (await h.db.select().from(orders).where(eq(orders.id, id)))[0];

/** A member booked on a Reformer with a 100 Kč surcharge, with `credit` bought for surcharges. */
async function member(credit: number) {
  const s = await makeSession(h.db);
  await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, s.classTypeId));
  const u = await makeUser(h.db, credit);
  await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
  const opt = (await bookingOptions(h.db, u.id, s)).find((o) => o.method === "membership")!;
  const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: opt.entitlementId }, NOW);
  expect((await bookingOf(booking.id)).surcharge).toBe(10000);
  return { u, booking };
}

describe("a surcharge paid from credit", () => {
  it("takes 1 kredit per 1 Kč, marks it paid and calls the open transfer off", async () => {
    const { u, booking } = await member(1100);
    const transfer = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    const r = await paySurchargeWithCredits(h.db, { bookingId: booking.id, userId: u.id }, NOW);
    expect(r.credits).toBe(100);
    expect((await userOf(u.id)).creditBalance).toBe(1000);
    expect((await bookingOf(booking.id)).surchargePaidAt).toEqual(NOW);
    expect((await orderOf(transfer.id)).status).toBe("cancelled");
    // it's in the client's credit history with the booking
    const [tx] = await h.db.select().from(creditTransactions).where(and(eq(creditTransactions.userId, u.id), eq(creditTransactions.bookingId, booking.id)));
    expect(tx).toMatchObject({ delta: -100, reason: "booking" });
    // no longer among the unpaid ones
    expect((await unpaidBookings(h.db)).some((x) => x.bookingId === booking.id)).toBe(false);
  });

  it("isn't paid twice – nor when the transfer already arrived", async () => {
    const { u, booking } = await member(1100);
    await paySurchargeWithCredits(h.db, { bookingId: booking.id }, NOW);
    await expect(paySurchargeWithCredits(h.db, { bookingId: booking.id }, NOW)).rejects.toThrow(/už je zaplacený/);
    expect((await userOf(u.id)).creditBalance).toBe(1000);

    const other = await member(1100);
    const o = await createSurchargeOrder(h.db, { userId: other.u.id, bookingId: other.booking.id });
    await fulfillOrder(h.db, { orderId: o.id, provider: "transfer" }, NOW);
    await expect(paySurchargeWithCredits(h.db, { bookingId: other.booking.id }, NOW)).rejects.toThrow(/už je zaplacený/);
    expect((await userOf(other.u.id)).creditBalance).toBe(1100);
  });

  it("not enough credit → nothing changes", async () => {
    const { u, booking } = await member(50);
    await expect(paySurchargeWithCredits(h.db, { bookingId: booking.id, userId: u.id }, NOW)).rejects.toThrow(/dostatek kreditu/);
    expect((await userOf(u.id)).creditBalance).toBe(50);
    expect((await bookingOf(booking.id)).surchargePaidAt).toBeNull();
  });

  it("credit that ran out can't pay it", async () => {
    const { u, booking } = await member(1100);
    await h.db.update(users).set({ creditExpiresAt: new Date(Date.now() - 86_400_000) }).where(eq(users.id, u.id));
    await expect(paySurchargeWithCredits(h.db, { bookingId: booking.id }, NOW)).rejects.toThrow();
    expect((await bookingOf(booking.id)).surchargePaidAt).toBeNull();
  });

  it("a client pays only their own booking", async () => {
    const { u, booking } = await member(1100);
    const stranger = await makeUser(h.db, 1100);
    await expect(paySurchargeWithCredits(h.db, { bookingId: booking.id, userId: stranger.id }, NOW)).rejects.toThrow(/nenalezena/);
    expect((await userOf(u.id)).creditBalance).toBe(1100);
  });

  it("cancelled in time → the credit comes back", async () => {
    const { u, booking } = await member(1100);
    await paySurchargeWithCredits(h.db, { bookingId: booking.id }, NOW);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect((await userOf(u.id)).creditBalance).toBe(1100);
  });

  it("a card payment finished after it comes back as credit, not paid twice", async () => {
    const { u, booking } = await member(1100);
    const card = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    await paySurchargeWithCredits(h.db, { bookingId: booking.id }, NOW);
    const r = await fulfillOrder(h.db, { orderId: card.id, provider: "stripe", providerRef: `cs_${card.id}` }, NOW);
    expect(r.surcharge).toMatchObject({ outcome: "credited", credit: 100 });
    expect((await userOf(u.id)).creditBalance).toBe(1100);
  });
});
