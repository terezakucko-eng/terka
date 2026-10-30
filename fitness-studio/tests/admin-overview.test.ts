import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orders } from "@/db/schema";
import { createProductOrder, fulfillOrder, reservePresaleMembership } from "@/domain/orders";
import { newMemberships } from "@/domain/stats";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { NOW, makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("admin overview: new memberships", () => {
  it("lists memberships ordered on the web (paid or waiting), reserved in presale and set up in the studio – not passes, not cancelled orders", async () => {
    const m = await makeProduct(h.db, { kind: "membership", name: "Členství", price: 140000, validityDays: 31 });
    const y2027 = await makeProduct(h.db, { kind: "membership", name: "Členství 2027", price: 140000, validityDays: 31, saleFrom: pragueLocalToDate("2027-01-01T00:00"), presaleFrom: NOW });
    const pass = await makeProduct(h.db, { kind: "pass", name: "Permanentka", entries: 10, validityDays: 60 });
    const u: Record<"paid" | "waiting" | "cancelled" | "presale" | "studio" | "passBuyer", { id: string }> = {
      paid: await makeUser(h.db),
      waiting: await makeUser(h.db),
      cancelled: await makeUser(h.db),
      presale: await makeUser(h.db),
      studio: await makeUser(h.db),
      passBuyer: await makeUser(h.db),
    };

    const order = async (userId: string, productId: string) => (await createProductOrder(h.db, { userId, productId, commitmentAccepted: true }, NOW)).order;
    await fulfillOrder(h.db, { orderId: (await order(u.paid.id, m.id)).id, provider: "transfer" }, NOW);
    await order(u.waiting.id, m.id);
    await h.db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, (await order(u.cancelled.id, m.id)).id));
    await reservePresaleMembership(h.db, { userId: u.presale.id, productId: y2027.id, commitmentAccepted: true }, NOW);
    await grantEntitlement(h.db, { userId: u.studio.id, kind: "membership", name: "Členství", entries: null, validityDays: 31 }, NOW);
    await fulfillOrder(h.db, { orderId: (await order(u.passBuyer.id, pass.id)).id, provider: "transfer" }, NOW);

    const rows = await newMemberships(h.db, new Date(0));
    expect(Object.fromEntries(rows.map((r) => [r.userId, r.how]))).toEqual({
      [u.paid.id]: "paid",
      [u.waiting.id]: "waiting",
      [u.presale.id]: "presale",
      [u.studio.id]: "studio",
    });
    expect(rows.find((r) => r.userId === u.presale.id)!.product).toBe("Členství 2027");
    // newest first
    expect(rows.map((r) => r.at.getTime())).toEqual([...rows.map((r) => r.at.getTime())].sort((a, b) => b - a));
    // and nothing from before the window
    expect(await newMemberships(h.db, new Date(Date.now() + 86_400_000))).toEqual([]);
  });
});
