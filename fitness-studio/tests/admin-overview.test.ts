import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orders } from "@/db/schema";
import { createProductOrder, fulfillOrder, reservePresaleMembership } from "@/domain/orders";
import { nextYearMemberships } from "@/domain/stats";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { NOW, makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("admin overview: memberships for next year", () => {
  it("lists the presale (paid, reserved, waiting) and memberships set up for the year – not this year's, passes or cancelled orders", async () => {
    const JAN = pragueLocalToDate("2027-01-01T00:00");
    const y2027 = await makeProduct(h.db, { kind: "membership", name: "Členství 2027", price: 140000, validityDays: 31, saleFrom: JAN, presaleFrom: NOW });
    const y2026 = await makeProduct(h.db, { kind: "membership", name: "Členství 2026", price: 120000, validityDays: 31 });
    const pass = await makeProduct(h.db, { kind: "pass", name: "Permanentka", entries: 10, validityDays: 60 });
    const u = {
      paid: await makeUser(h.db),
      waiting: await makeUser(h.db),
      cancelled: await makeUser(h.db),
      reserved: await makeUser(h.db),
      pair: await makeUser(h.db),
      thisYear: await makeUser(h.db),
      passBuyer: await makeUser(h.db),
    };
    const order = async (userId: string, productId: string) => (await createProductOrder(h.db, { userId, productId, commitmentAccepted: true }, NOW)).order;

    await fulfillOrder(h.db, { orderId: (await order(u.paid.id, y2027.id)).id, provider: "card" }, NOW);
    await order(u.waiting.id, y2027.id);
    await h.db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, (await order(u.cancelled.id, y2027.id)).id));
    await reservePresaleMembership(h.db, { userId: u.reserved.id, productId: y2027.id, commitmentAccepted: true }, NOW);
    // set up by the studio from November for 12 months (a special price for two)
    await grantEntitlement(h.db, { userId: u.pair.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 365, validUntil: pragueLocalToDate("2027-11-01T00:00") }, NOW);
    // bought now, runs 365 days – ends in October next year
    await fulfillOrder(h.db, { orderId: (await order(u.thisYear.id, y2026.id)).id, provider: "card" }, NOW);
    await fulfillOrder(h.db, { orderId: (await order(u.passBuyer.id, pass.id)).id, provider: "card" }, NOW);

    const rows = await nextYearMemberships(h.db, 2027, NOW);
    expect(Object.fromEntries(rows.map((r) => [r.userId, r.how]))).toEqual({
      [u.paid.id]: "paid",
      [u.waiting.id]: "waiting",
      [u.reserved.id]: "presale",
      [u.pair.id]: "studio",
    });
    expect(rows.find((r) => r.userId === u.reserved.id)!.product).toBe("Členství 2027");
    // newest first
    expect(rows.map((r) => r.at.getTime())).toEqual([...rows.map((r) => r.at.getTime())].sort((a, b) => b - a));
    // a waiting order that has run out isn't waiting any more
    expect((await nextYearMemberships(h.db, 2027, new Date(Date.now() + 2 * 86_400_000))).map((r) => r.userId)).not.toContain(u.waiting.id);
  });
});
