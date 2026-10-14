import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { orders, users } from "@/db/schema";
import { cancelOrder, createProductOrder, fulfillOrder } from "@/domain/orders";
import { NOW, makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const balance = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;

describe("an unpaid order on the client's card", () => {
  it("confirmed: the credit is added; cancelled: nothing is, and it can't be cancelled twice", async () => {
    const u = await makeUser(h.db);
    const pack = await makeProduct(h.db, { kind: "credit_pack", credits: 1100, price: 100000 });
    const { order: paid } = await createProductOrder(h.db, { userId: u.id, productId: pack.id }, NOW);
    const { order: dropped } = await createProductOrder(h.db, { userId: u.id, productId: pack.id }, NOW);

    await fulfillOrder(h.db, { orderId: paid.id, provider: "transfer" }, NOW);
    expect(await balance(u.id)).toBe(1100);

    expect(await cancelOrder(h.db, dropped.id, NOW)).toBe(true);
    expect((await h.db.select().from(orders).where(eq(orders.id, dropped.id)))[0].status).toBe("cancelled");
    expect(await cancelOrder(h.db, dropped.id, NOW)).toBe(false);
    expect(await cancelOrder(h.db, paid.id, NOW)).toBe(false);
    expect(await balance(u.id)).toBe(1100);
  });
});
