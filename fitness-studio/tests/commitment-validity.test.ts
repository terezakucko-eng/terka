import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, orders } from "@/db/schema";
import { createProductOrder, fulfillOrder } from "@/domain/orders";
import { pragueLocalToDate } from "@/lib/dates";
import { NOW, makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const JAN = pragueLocalToDate("2027-01-01T00:00");
const DAY = 86_400_000;
const buy = async (productId: string) => {
  const u = await makeUser(h.db);
  const { order } = await createProductOrder(h.db, { userId: u.id, productId, commitmentAccepted: true }, NOW);
  await fulfillOrder(h.db, { orderId: order.id, provider: "transfer" }, NOW);
  return (await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id)))[0];
};

describe("a membership with commitment paid once runs for the whole commitment", () => {
  it("bought in presale: 1 January to 31 December, not just the 31 days of its price list item", async () => {
    const p = await makeProduct(h.db, { kind: "membership", price: 250000, validityDays: 31, commitmentMonths: 12, saleFrom: JAN, presaleFrom: NOW });
    const e = await buy(p.id);
    expect(e.validFrom).toEqual(JAN);
    expect(e.validUntil).toEqual(pragueLocalToDate("2027-12-31T23:59"));
  });

  it("bought now: to the end of the twelfth month, the purchase month included", async () => {
    const p = await makeProduct(h.db, { kind: "membership", price: 140000, validityDays: 31, commitmentMonths: 12 });
    expect((await buy(p.id)).validUntil).toEqual(pragueLocalToDate("2027-09-30T23:59"));
  });

  it("without commitment it keeps the days of the price list item", async () => {
    const p = await makeProduct(h.db, { kind: "membership", price: 160000, validityDays: 31, commitmentMonths: 0 });
    const e = await buy(p.id);
    expect(e.validUntil.getTime() - e.validFrom.getTime()).toBe(31 * DAY);
  });
});

describe("migration 0086", () => {
  it("extends the short ones bought once, leaves card subscriptions and long ones alone", async () => {
    const p = await makeProduct(h.db, { kind: "membership", price: 250000, validityDays: 31, commitmentMonths: 12 });
    const flexible = await makeProduct(h.db, { kind: "membership", price: 160000, validityDays: 31, commitmentMonths: 0 });
    const u = await makeUser(h.db);
    const [o] = await h.db.insert(orders).values({ userId: u.id, kind: "product", productId: p.id, description: "x", amount: 1, provider: "transfer", status: "paid" }).returning();
    const row = (over: Partial<typeof entitlements.$inferInsert>) =>
      h.db.insert(entitlements).values({ userId: u.id, kind: "membership", name: "x", productId: p.id, validFrom: JAN, validUntil: new Date(JAN.getTime() + 31 * DAY), ...over }).returning().then((r) => r[0]);
    const presale = await row({ orderId: o.id });
    const studio = await row({ note: "Nastaveno studiem – platí od 1. 1. 2027" });
    const card = await row({ orderId: o.id, subscriptionId: "sub_1" });
    const long = await row({ orderId: o.id, validUntil: pragueLocalToDate("2027-06-30T23:59") });
    const flex = await row({ orderId: o.id, productId: flexible.id });

    const update = readFileSync("drizzle/0086_commitment_validity.sql", "utf8");
    await h.db.execute(sql.raw(update));
    await h.db.execute(sql.raw(update)); // safe to repeat
    const until = async (id: string) => (await h.db.select().from(entitlements).where(eq(entitlements.id, id)))[0].validUntil;
    expect(await until(presale.id)).toEqual(pragueLocalToDate("2027-12-31T23:59"));
    expect(await until(studio.id)).toEqual(pragueLocalToDate("2027-12-31T23:59"));
    expect(await until(card.id)).toEqual(card.validUntil);
    expect(await until(long.id)).toEqual(long.validUntil);
    expect(await until(flex.id)).toEqual(flex.validUntil);
  });
});
