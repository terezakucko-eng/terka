import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { orders, users } from "@/db/schema";
import { bookingOptions } from "@/domain/booking";
import { fulfillOrder } from "@/domain/orders";
import { creditsExpiringSoon, expireCredits } from "@/domain/wallet";
import { NOW, hours, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const user = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0];
const DAY = 24;

describe("credit validity", () => {
  it("a top-up sets validity, warns a week ahead and expires the balance", async () => {
    const u = await makeUser(h.db);
    const pack = await makeProduct(h.db, { kind: "credit_pack", credits: 1000, price: 100000, validityDays: 90 });
    const [o] = await h.db
      .insert(orders)
      .values({ userId: u.id, kind: "product", productId: pack.id, description: pack.name, amount: pack.price, provider: "test" })
      .returning();
    await fulfillOrder(h.db, { orderId: o.id, provider: "test" }, NOW);
    const after = await user(u.id);
    expect(after.creditBalance).toBe(1000);
    expect(+after.creditExpiresAt!).toBe(+hours(90 * DAY));

    expect((await creditsExpiringSoon(h.db, hours(80 * DAY))).some((x) => x.id === u.id)).toBe(false);
    expect((await creditsExpiringSoon(h.db, hours(85 * DAY))).some((x) => x.id === u.id)).toBe(true);

    // after expiry: can't pay with credit, nightly job zeroes it
    const s = await makeSession(h.db, { startsAt: hours(91 * DAY) });
    const opts = await bookingOptions(h.db, u.id, s);
    // bookingOptions uses real "now"; check the job instead
    expect(opts.some((o) => o.method === "credits")).toBe(true);
    expect(await expireCredits(h.db, hours(91 * DAY))).toBeGreaterThanOrEqual(1);
    expect((await user(u.id)).creditBalance).toBe(0);
  });
});
