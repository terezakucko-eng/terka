import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classTypes, entitlements, orders, users } from "@/db/schema";
import { bookSession, bookingOptions, changeBookingPayment } from "@/domain/booking";
import { createProductOrder, fulfillOrder } from "@/domain/orders";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { saveSettings } from "@/lib/settings";
import { NOW, hours, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
  await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 90, memberBookingWindowDays: 90 });
});
afterAll(async () => h.close());

const bookingOf = async (id: string) => (await h.db.select().from(bookings).where(eq(bookings.id, id)))[0];
const balance = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;
const used = async (id: string) => (await h.db.select().from(entitlements).where(eq(entitlements.id, id)))[0].entriesUsed;
const pass = (userId: string, entries = 10) => grantEntitlement(h.db, { userId, kind: "pass", name: "Permanentka", entries, validityDays: 60 }, NOW);
const membership = (userId: string) => grantEntitlement(h.db, { userId, kind: "membership", name: "Členství", entries: null, validityDays: 60 }, NOW);

describe("reception changes how a booking is paid", () => {
  it("a drop-in waiting for a transfer → the membership: confirmed, the transfer called off – paid anyway, it's credit", async () => {
    const s = await makeSession(h.db, { creditCost: 250 });
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    const m = await membership(u.id);
    await changeBookingPayment(h.db, { bookingId: booking.id, pay: { method: "membership", entitlementId: m.id }, isAdmin: true }, NOW);
    expect(await bookingOf(booking.id)).toMatchObject({ status: "confirmed", method: "membership", entitlementId: m.id, orderId: null });
    expect((await h.db.select().from(orders).where(eq(orders.id, order!.id)))[0].status).toBe("cancelled");
    const late = await fulfillOrder(h.db, { orderId: order!.id, provider: "transfer" }, NOW);
    expect(late.dropIn).toMatchObject({ outcome: "credited", credit: 250 });
    expect(await bookingOf(booking.id)).toMatchObject({ status: "confirmed", method: "membership" });
  });

  it("a pass entry ↔ credit: what it cost comes back, the new one is taken", async () => {
    const s = await makeSession(h.db, { creditCost: 250 });
    const u = await makeUser(h.db, 300);
    const p = await pass(u.id);
    const opt = (await bookingOptions(h.db, u.id, s)).find((o) => o.method === "pass")!;
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: opt.entitlementId }, NOW);
    expect(await used(p.id)).toBe(1);

    await changeBookingPayment(h.db, { bookingId: booking.id, pay: { method: "credits" }, isAdmin: false }, NOW);
    expect(await used(p.id)).toBe(0);
    expect(await balance(u.id)).toBe(50);
    expect(await bookingOf(booking.id)).toMatchObject({ method: "credits", creditsCharged: 250, entitlementId: null });

    await changeBookingPayment(h.db, { bookingId: booking.id, pay: { method: "pass", entitlementId: p.id }, isAdmin: false }, NOW);
    expect(await balance(u.id)).toBe(300);
    expect(await used(p.id)).toBe(1);
  });

  it("the new payment can't be charged → nothing changes", async () => {
    const s = await makeSession(h.db, { creditCost: 250 });
    const u = await makeUser(h.db, 100);
    const p = await pass(u.id);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: p.id }, NOW);
    await expect(changeBookingPayment(h.db, { bookingId: booking.id, pay: { method: "credits" }, isAdmin: true }, NOW)).rejects.toThrow(/dostatek kreditu/);
    expect(await bookingOf(booking.id)).toMatchObject({ method: "pass", entitlementId: p.id });
    expect(await used(p.id)).toBe(1);
    expect(await balance(u.id)).toBe(100);
    await expect(changeBookingPayment(h.db, { bookingId: booking.id, pay: { method: "pass", entitlementId: p.id }, isAdmin: true }, NOW)).rejects.toThrow(/už je placená/);
  });

  it("an instructor: not 'without payment', nor after the class started – an admin can", async () => {
    const s = await makeSession(h.db, { startsAt: hours(1) });
    const u = await makeUser(h.db);
    const p = await pass(u.id);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: p.id }, NOW);
    await expect(changeBookingPayment(h.db, { bookingId: booking.id, pay: "admin", isAdmin: false }, NOW)).rejects.toThrow(/jen administrátor/);
    await expect(
      changeBookingPayment(h.db, { bookingId: booking.id, pay: { method: "credits" }, isAdmin: false }, hours(2)),
    ).rejects.toThrow(/jen administrátor/);
    await changeBookingPayment(h.db, { bookingId: booking.id, pay: "admin", isAdmin: true }, hours(2));
    expect(await bookingOf(booking.id)).toMatchObject({ method: "admin", entitlementId: null });
    expect(await used(p.id)).toBe(0);
  });

  it("a lesson included in the membership moved to a pass → the month's next surcharged one is included instead", async () => {
    const times = ["2026-11-02T17:00", "2026-11-04T17:00", "2026-11-09T17:00"];
    const s0 = await makeSession(h.db, { capacity: 6, startsAt: pragueLocalToDate(times[0]) });
    await h.db.update(classTypes).set({ memberSurcharge: 25000, memberSurchargeFrom: "2026-11-01" }).where(eq(classTypes.id, s0.classTypeId));
    const ses = [s0];
    for (const t of times.slice(1)) ses.push(await makeSession(h.db, { classTypeId: s0.classTypeId, capacity: 6, startsAt: pragueLocalToDate(t) }));
    const tier = await makeProduct(h.db, { kind: "membership", name: "Členství Reformer", price: 229000, validityDays: 365, includedClassTypeId: s0.classTypeId, includedPerMonth: 2 });
    const u = await makeUser(h.db);
    const { order } = await createProductOrder(h.db, { userId: u.id, productId: tier.id, commitmentAccepted: true }, NOW);
    await fulfillOrder(h.db, { orderId: order.id, provider: "test" }, NOW);
    const [e] = await h.db.select().from(entitlements).where(and(eq(entitlements.userId, u.id), eq(entitlements.kind, "membership")));
    const ids: string[] = [];
    for (const s of ses) ids.push((await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: e.id }, NOW)).booking.id);
    expect((await bookingOf(ids[2])).surcharge).toBe(25000);

    const p = await pass(u.id);
    await changeBookingPayment(h.db, { bookingId: ids[0], pay: { method: "pass", entitlementId: p.id }, isAdmin: true }, NOW);
    expect(await bookingOf(ids[0])).toMatchObject({ method: "pass", entitlementId: p.id });
    expect((await bookingOf(ids[2])).surcharge).toBe(0);
  });
});
