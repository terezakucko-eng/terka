import { and, eq, inArray } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classTypes, entitlements, orders } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking, includedSummary, membershipIncluding } from "@/domain/booking";
import { createMonthlyFees, membershipUpgrades, switchMembership, switchPeriod } from "@/domain/membership-fees";
import { createProductOrder, createSurchargeOrder, fulfillOrder } from "@/domain/orders";
import { pragueLocalToDate } from "@/lib/dates";
import { saveSettings } from "@/lib/settings";
import { NOW, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
  // November classes can be booked already in October
  await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 90, memberBookingWindowDays: 90 });
});
afterAll(async () => h.close());

const buy = async (userId: string, productId: string) => {
  const { order } = await createProductOrder(h.db, { userId, productId, commitmentAccepted: true }, NOW);
  await fulfillOrder(h.db, { orderId: order.id, provider: "test" }, NOW);
  const [e] = await h.db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.kind, "membership")));
  return e;
};
const surcharges = async (ids: string[]) => {
  const rows = await h.db.select().from(bookings).where(inArray(bookings.id, ids));
  return ids.map((id) => rows.find((b) => b.id === id)!.surcharge);
};
/** A Reformer-like class (6 places, members pay 250 Kč from `from`) with sessions at the given Prague times. */
async function reformer(from: string, times: string[]) {
  const [first, ...rest] = times;
  const s0 = await makeSession(h.db, { capacity: 6, startsAt: pragueLocalToDate(first) });
  await h.db.update(classTypes).set({ name: "Reformer fusion", memberSurcharge: 25000, memberSurchargeFrom: from }).where(eq(classTypes.id, s0.classTypeId));
  const others = [];
  for (const t of rest) others.push(await makeSession(h.db, { classTypeId: s0.classTypeId, capacity: 6, startsAt: pragueLocalToDate(t) }));
  return [s0, ...others];
}

describe("Členství Reformer", () => {
  it("includes 4 Reformers a month without the member surcharge", async () => {
    const ses = await reformer("2026-11-01", ["2026-11-02T17:00", "2026-11-04T17:00", "2026-11-08T17:00", "2026-11-11T17:00", "2026-11-15T17:00", "2026-11-18T17:00", "2026-12-02T17:00"]);
    const tier = await makeProduct(h.db, { kind: "membership", name: "Členství Reformer", price: 229000, validityDays: 365, includedClassTypeId: ses[0].classTypeId, includedPerMonth: 4 });
    expect(await membershipIncluding(h.db, ses[0].classTypeId)).toEqual({ name: "Členství Reformer", perMonth: 4 });
    const u = await makeUser(h.db);
    const e = await buy(u.id, tier.id);
    expect(e).toMatchObject({ monthlyFee: 229000, includedPerMonth: 4, includedClassTypeId: ses[0].classTypeId, includedFrom: null });
    // the November fee follows the membership's own price
    const [fee] = await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400, userIds: [u.id] });
    expect(fee.amount).toBe(229000);

    const opt = (s: (typeof ses)[number]) => bookingOptions(h.db, u.id, s).then((o) => o.find((x) => x.method === "membership")!);
    expect((await opt(ses[0])).detail).toBe("neomezeně · v ceně členství, na listopad zbývají 4");
    const book = (s: (typeof ses)[number], at = NOW) =>
      bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: e.id }, at).then((r) => r.booking.id);
    const ids: string[] = [];
    for (const s of ses.slice(0, 5)) ids.push(await book(s));
    expect(await surcharges(ids)).toEqual([0, 0, 0, 0, 25000]);
    expect((await opt(ses[5])).detail).toMatch(/^neomezeně · doplatek 250\sKč \(kartou nebo převodem\), lekce v ceně na tento měsíc jsou vyčerpané$/);
    // December starts again
    expect((await opt(ses[6])).detail).toBe("neomezeně · v ceně členství, na prosinec zbývají 4");

    // cancelled in time: the allowance moves to the unpaid surcharged booking, its payment is called off
    const pay = await createSurchargeOrder(h.db, { userId: u.id, bookingId: ids[4] });
    await cancelBooking(h.db, { bookingId: ids[1], actorId: u.id }, NOW);
    expect(await surcharges([ids[4]])).toEqual([0]);
    expect((await h.db.select().from(orders).where(eq(orders.id, pay.id)))[0].status).toBe("cancelled");

    // cancelled late: it counts as used
    await cancelBooking(h.db, { bookingId: ids[2], actorId: u.id }, new Date(ses[2].startsAt.getTime() - 2 * 3_600_000));
    expect(await surcharges([await book(ses[5])])).toEqual([25000]);

    expect((await includedSummary(h.db, [e], pragueLocalToDate("2026-11-20T10:00"))).get(e.id)).toEqual({
      className: "Reformer fusion",
      perMonth: 4,
      from: null,
      left: 0,
    });
  });

  it("a member switches from the next month – new price and included Reformers from then", async () => {
    const ses = await reformer("2026-10-01", ["2026-10-20T17:00", "2026-11-03T17:00"]);
    const basic = await makeProduct(h.db, { kind: "membership", name: "Členství", price: 140000, validityDays: 365, sortOrder: -20 });
    const tier = await makeProduct(h.db, {
      kind: "membership",
      name: "Členství Reformer",
      price: 229000,
      validityDays: 365,
      includedClassTypeId: ses[0].classTypeId,
      includedPerMonth: 4,
      sortOrder: -10,
    });
    const u = await makeUser(h.db);
    const e = await buy(u.id, basic.id);
    // a member moves up in the account, not by buying a second membership
    await expect(createProductOrder(h.db, { userId: u.id, productId: tier.id, commitmentAccepted: true }, NOW)).rejects.toThrow("přejdeš v Můj účet");

    const [nov] = await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400, userIds: [u.id] });
    expect(nov.amount).toBe(140000);
    expect((await membershipUpgrades(h.db, [e], NOW)).get(e.id)?.id).toBe(tier.id);
    await expect(switchMembership(h.db, u.id, e.id, basic.id, NOW)).rejects.toThrow("nejde");

    const done = await switchMembership(h.db, u.id, e.id, tier.id, NOW);
    expect(done.period).toBe("2026-11");
    const [after] = await h.db.select().from(entitlements).where(eq(entitlements.id, e.id));
    expect(after).toMatchObject({ name: "Členství Reformer", productId: tier.id, monthlyFee: 229000, includedPerMonth: 4, includedFrom: "2026-11" });
    expect(after.validUntil).toEqual(e.validUntil); // commitment unchanged
    expect((await h.db.select().from(orders).where(eq(orders.id, nov.id)))[0].amount).toBe(229000);
    expect(await membershipUpgrades(h.db, [after], NOW)).toEqual(new Map());
    expect((await includedSummary(h.db, [after], NOW)).get(e.id)).toMatchObject({ perMonth: 4, from: "2026-11", left: null });

    // October still with the surcharge, November included
    const book = (s: (typeof ses)[number]) =>
      bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: e.id }, NOW).then((r) => r.booking.id);
    expect(await surcharges([await book(ses[0]), await book(ses[1])])).toEqual([25000, 0]);
  });

  it("starts a month later when the next month is already paid; no commitment stays without", async () => {
    const ses = await reformer("2026-11-01", ["2026-11-05T17:00"]);
    const flexBasic = await makeProduct(h.db, { kind: "membership", price: 179000, validityDays: 3650, commitmentMonths: 0 });
    const flexTier = await makeProduct(h.db, {
      kind: "membership",
      name: "Členství Reformer bez závazku",
      price: 269000,
      validityDays: 3650,
      commitmentMonths: 0,
      includedClassTypeId: ses[0].classTypeId,
      includedPerMonth: 4,
      sortOrder: -30,
    });
    const u = await makeUser(h.db);
    const e = await buy(u.id, flexBasic.id);
    const [nov] = await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400, userIds: [u.id] });
    await fulfillOrder(h.db, { orderId: nov.id, provider: "transfer" }, NOW);
    expect(await switchPeriod(h.db, u.id, NOW)).toBe("2026-12");
    expect((await membershipUpgrades(h.db, [e], NOW)).get(e.id)?.id).toBe(flexTier.id);
    const done = await switchMembership(h.db, u.id, e.id, flexTier.id, NOW);
    expect(done.period).toBe("2026-12");
    expect((await h.db.select().from(orders).where(eq(orders.id, nov.id)))[0].amount).toBe(179000); // paid stays as paid
  });
});
