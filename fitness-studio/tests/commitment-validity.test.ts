import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, orders } from "@/db/schema";
import { createMonthlyFees } from "@/domain/membership-fees";
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

describe("a membership paid once lasts 365 days", () => {
  it("bought in presale: 1 January to 31 December, not just the 31 days of its price list item", async () => {
    const p = await makeProduct(h.db, { kind: "membership", price: 250000, validityDays: 31, commitmentMonths: 12, saleFrom: JAN, presaleFrom: NOW });
    const e = await buy(p.id);
    expect(e.validFrom).toEqual(JAN);
    expect(e.validUntil).toEqual(pragueLocalToDate("2027-12-31T23:59"));
  });

  it("bought now: to the day before, a year on – 12 payments, none for the few days of the 13th month", async () => {
    const p = await makeProduct(h.db, { kind: "membership", price: 140000, validityDays: 31, commitmentMonths: 12 });
    const e = await buy(p.id);
    expect(e.validUntil).toEqual(pragueLocalToDate("2027-10-04T23:59"));
    const fees = async (period: string) => (await createMonthlyFees(h.db, { period, amountKc: 1400, userIds: [e.userId] })).length;
    // October paid by the purchase, November to September by requests, the 13th October none
    expect([await fees("2026-10"), await fees("2026-11"), await fees("2027-09"), await fees("2027-10")]).toEqual([0, 1, 1, 0]);
  });

  it("without commitment too (she can end it any time)", async () => {
    const p = await makeProduct(h.db, { kind: "membership", price: 160000, validityDays: 3650, commitmentMonths: 0 });
    expect((await buy(p.id)).validUntil).toEqual(pragueLocalToDate("2027-10-04T23:59"));
  });
});

describe("migrations 0086 and 0087", () => {
  it("extends the short ones bought once, leaves card subscriptions and long ones alone", async () => {
    const p = await makeProduct(h.db, { kind: "membership", price: 250000, validityDays: 31, commitmentMonths: 12 });
    const flexible = await makeProduct(h.db, { kind: "membership", price: 160000, validityDays: 3650, commitmentMonths: 0 });
    const u = await makeUser(h.db);
    const [o] = await h.db.insert(orders).values({ userId: u.id, kind: "product", productId: p.id, description: "x", amount: 1, provider: "transfer", status: "paid" }).returning();
    const row = (over: Partial<typeof entitlements.$inferInsert>) =>
      h.db.insert(entitlements).values({ userId: u.id, kind: "membership", name: "x", productId: p.id, validFrom: JAN, validUntil: new Date(JAN.getTime() + 31 * DAY), ...over }).returning().then((r) => r[0]);
    const presale = await row({ orderId: o.id });
    const studio = await row({ note: "Nastaveno studiem – platí od 1. 1. 2027" });
    const card = await row({ orderId: o.id, subscriptionId: "sub_1" });
    const long = await row({ orderId: o.id, validUntil: pragueLocalToDate("2027-06-30T23:59") });
    const october = pragueLocalToDate("2026-10-03T10:15");
    const bought = await row({ orderId: o.id, validFrom: october, validUntil: new Date(october.getTime() + 31 * DAY) });
    const flex = await row({ orderId: o.id, productId: flexible.id, validFrom: october, validUntil: new Date(october.getTime() + 3650 * DAY) });
    const ended = await row({ orderId: o.id, productId: flexible.id, validFrom: october, validUntil: pragueLocalToDate("2026-12-01T00:00"), renewalCancelled: true });

    const run = async (file: string) => {
      const update = readFileSync(file, "utf8");
      await h.db.execute(sql.raw(update));
      await h.db.execute(sql.raw(update)); // safe to repeat
    };
    await run("drizzle/0086_commitment_validity.sql");
    await run("drizzle/0087_membership_year.sql");
    const until = async (id: string) => (await h.db.select().from(entitlements).where(eq(entitlements.id, id)))[0].validUntil;
    expect(await until(presale.id)).toEqual(pragueLocalToDate("2027-12-31T23:59"));
    expect(await until(studio.id)).toEqual(pragueLocalToDate("2027-12-31T23:59"));
    expect(await until(bought.id)).toEqual(pragueLocalToDate("2027-10-02T23:59"));
    expect(await until(flex.id)).toEqual(pragueLocalToDate("2027-10-02T23:59"));
    expect(await until(card.id)).toEqual(card.validUntil);
    expect(await until(long.id)).toEqual(long.validUntil);
    expect(await until(ended.id)).toEqual(ended.validUntil);
  });
});
