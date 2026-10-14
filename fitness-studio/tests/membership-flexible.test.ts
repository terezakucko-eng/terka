import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, orders } from "@/db/schema";
import { createMonthlyFees, endFlexibleMembership, flexibleMemberships } from "@/domain/membership-fees";
import { createProductOrder, fulfillOrder } from "@/domain/orders";
import { NOW, makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const buy = async (userId: string, productId: string, commitmentAccepted?: boolean) => {
  const { order } = await createProductOrder(h.db, { userId, productId, commitmentAccepted }, NOW);
  await fulfillOrder(h.db, { orderId: order.id, provider: "test" }, NOW);
  const [e] = await h.db.select().from(entitlements).where(and(eq(entitlements.userId, userId), eq(entitlements.kind, "membership")));
  return e;
};

describe("membership without commitment", () => {
  it("needs no commitment box, bills its own monthly price and can be ended by the client", async () => {
    const u = await makeUser(h.db);
    const flex = await makeProduct(h.db, { kind: "membership", name: "Členství bez závazku", price: 179000, validityDays: 3650, commitmentMonths: 0 });
    const e = await buy(u.id, flex.id, false);
    expect(e.monthlyFee).toBe(179000);
    expect(await flexibleMemberships(h.db, [e.id])).toEqual(new Set([e.id]));

    // November fee at its own price, not the default 1 400 Kč
    const [fee] = await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400, userIds: [u.id] });
    expect(fee.amount).toBe(179000);

    // ended in October: runs to the end of October, the unpaid November fee is dropped
    const end = await endFlexibleMembership(h.db, u.id, e.id, NOW);
    expect(end.toISOString()).toBe("2026-10-31T23:00:00.000Z"); // 1 Nov 00:00 Prague
    const [after] = await h.db.select().from(entitlements).where(eq(entitlements.id, e.id));
    expect(after.renewalCancelled).toBe(true);
    const [nov] = await h.db.select().from(orders).where(eq(orders.id, fee.id));
    expect(nov.status).toBe("cancelled");
    expect(await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400, userIds: [u.id] })).toEqual([]);
  });

  it("runs to the end of an already paid next month", async () => {
    const u = await makeUser(h.db);
    const flex = await makeProduct(h.db, { kind: "membership", price: 179000, validityDays: 3650, commitmentMonths: 0 });
    const e = await buy(u.id, flex.id);
    const [fee] = await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400, userIds: [u.id] });
    await fulfillOrder(h.db, { orderId: fee.id, provider: "transfer" }, NOW);
    const end = await endFlexibleMembership(h.db, u.id, e.id, NOW);
    expect(end.toISOString()).toBe("2026-11-30T23:00:00.000Z"); // 1 Dec 00:00 Prague
  });

  it("keeps the 12-month membership as it was", async () => {
    const u = await makeUser(h.db);
    const yearly = await makeProduct(h.db, { kind: "membership", price: 140000, validityDays: 365 });
    expect(yearly.commitmentMonths).toBe(12);
    await expect(createProductOrder(h.db, { userId: u.id, productId: yearly.id, commitmentAccepted: false }, NOW)).rejects.toThrow("závazek na 12 měsíců");
    const e = await buy(u.id, yearly.id, true);
    expect(e.monthlyFee).toBeNull();
    await expect(endFlexibleMembership(h.db, u.id, e.id, NOW)).rejects.toThrow("jen po dohodě");
    const other = await makeUser(h.db);
    await expect(endFlexibleMembership(h.db, other.id, e.id, NOW)).rejects.toThrow("nenalezeno");
  });
});
