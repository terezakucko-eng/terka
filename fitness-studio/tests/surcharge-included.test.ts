import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classTypes, entitlements, orders, users } from "@/db/schema";
import { bookSession, cancelSession, setSurchargePaid } from "@/domain/booking";
import { createProductOrder, createSurchargeOrder, fulfillOrder, renewMembership } from "@/domain/orders";
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

/** A member with 2 Reformers a month included, and three November Reformers booked – the third with a 250 Kč surcharge. */
async function member() {
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
  return { u, e, ses, ids };
}

describe("a lesson included in the membership isn't lost when the studio cancels the class", () => {
  it("an unpaid surcharge on the next Reformer is waived", async () => {
    const { ses, ids } = await member();
    const pay = await createSurchargeOrder(h.db, { userId: (await bookingOf(ids[2])).userId, bookingId: ids[2] });
    await cancelSession(h.db, ses[0].id, NOW);
    expect((await bookingOf(ids[2])).surcharge).toBe(0);
    expect((await h.db.select().from(orders).where(eq(orders.id, pay.id)))[0].status).toBe("cancelled");
  });

  it("a surcharge already paid comes back as credit", async () => {
    const { u, ses, ids } = await member();
    const pay = await createSurchargeOrder(h.db, { userId: u.id, bookingId: ids[2] });
    await fulfillOrder(h.db, { orderId: pay.id, provider: "stripe", providerRef: "cs_x" }, NOW);
    await cancelSession(h.db, ses[1].id, NOW);
    expect(await bookingOf(ids[2])).toMatchObject({ surcharge: 0, surchargePaidAt: null });
    expect(await balance(u.id)).toBe(250);
  });
});

describe("surcharge paid at the desk", () => {
  it("calls the online payment off; paying it online anyway comes back as credit", async () => {
    const { u, ids } = await member();
    const pay = await createSurchargeOrder(h.db, { userId: u.id, bookingId: ids[2] });
    await setSurchargePaid(h.db, { bookingId: ids[2], paid: true, isAdmin: false }, NOW);
    expect((await bookingOf(ids[2])).surchargePaidAt).toEqual(NOW);
    expect((await h.db.select().from(orders).where(eq(orders.id, pay.id)))[0].status).toBe("cancelled");
    const r = await fulfillOrder(h.db, { orderId: pay.id, provider: "stripe", providerRef: "cs_late" }, NOW);
    expect(r.surcharge).toMatchObject({ outcome: "credited", credit: 250 });
    expect(await balance(u.id)).toBe(250);
  });

  it("only an admin takes the mark back – and never one paid by card or transfer", async () => {
    const { u, ids } = await member();
    await setSurchargePaid(h.db, { bookingId: ids[2], paid: true, isAdmin: false }, NOW);
    await expect(setSurchargePaid(h.db, { bookingId: ids[2], paid: false, isAdmin: false }, NOW)).rejects.toThrow(/administrátor/);
    await setSurchargePaid(h.db, { bookingId: ids[2], paid: false, isAdmin: true }, NOW);
    expect((await bookingOf(ids[2])).surchargePaidAt).toBeNull();

    const pay = await createSurchargeOrder(h.db, { userId: u.id, bookingId: ids[2] });
    await fulfillOrder(h.db, { orderId: pay.id, provider: "transfer" }, NOW);
    await expect(setSurchargePaid(h.db, { bookingId: ids[2], paid: false, isAdmin: true }, NOW)).rejects.toThrow(/smazáním/);
  });
});

describe("Stripe renewal of a membership", () => {
  async function subscribed() {
    const ct = (await makeSession(h.db)).classTypeId;
    const p = await makeProduct(h.db, { kind: "membership", name: "Členství Reformer", price: 229000, validityDays: 30, recurring: true, includedClassTypeId: ct, includedPerMonth: 4 });
    const u = await makeUser(h.db);
    const { order } = await createProductOrder(h.db, { userId: u.id, productId: p.id, commitmentAccepted: true }, NOW);
    const sub = `sub_${order.id}`;
    await fulfillOrder(h.db, { orderId: order.id, provider: "stripe", providerRef: `cs_${order.id}`, subscriptionId: sub }, NOW);
    const renew = (n: number) =>
      renewMembership(h.db, { provider: "stripe", subscriptionId: sub, invoiceId: `in_${n}_${order.id}`, amount: 229000, periodStart: hours(24 * 30 * n), periodEnd: hours(24 * 30 * (n + 1)) });
    return { u, ct, renew };
  }

  it("keeps what the membership includes", async () => {
    const { ct, renew } = await subscribed();
    const r = await renew(1);
    expect(r?.ent).toMatchObject({ includedClassTypeId: ct, includedPerMonth: 4 });
  });

  it("an ended membership isn't brought back – the payment is recorded for a refund", async () => {
    const { u, renew } = await subscribed();
    await h.db.update(entitlements).set({ status: "cancelled" }).where(eq(entitlements.userId, u.id));
    const r = await renew(1);
    expect(r).toMatchObject({ ent: null, order: { status: "paid", kind: "renewal", userId: u.id } });
    expect(await h.db.select().from(entitlements).where(and(eq(entitlements.userId, u.id), eq(entitlements.status, "active")))).toHaveLength(0);
  });
});
