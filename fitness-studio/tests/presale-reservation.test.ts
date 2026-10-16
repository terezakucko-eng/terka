import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, orders } from "@/db/schema";
import { PRESALE_RESERVED } from "@/domain/grant";
import { createMonthlyFees, membershipPlacesTaken } from "@/domain/membership-fees";
import { createProductOrder, fulfillOrder, reservePresaleMembership } from "@/domain/orders";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { NOW, makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const JAN = pragueLocalToDate("2027-01-01T00:00");
const YEAR_END = pragueLocalToDate("2027-12-31T23:59");
const fees = async (period: string, userId: string) =>
  (await createMonthlyFees(h.db, { period, amountKc: 1400, userIds: [userId] })).map((o) => o.amount);
const mine = (userId: string) => h.db.select().from(entitlements).where(eq(entitlements.userId, userId));

describe("a membership ordered in presale (for January)", () => {
  it("is in her card right away; this year's member pays December as usual and January from the December request", async () => {
    const y2027 = await makeProduct(h.db, { kind: "membership", name: "Členství 2027", price: 140000, validityDays: 31, saleFrom: JAN, presaleFrom: NOW });
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 1, validUntil: pragueLocalToDate("2026-12-31T23:59") }, NOW);

    await reservePresaleMembership(h.db, { userId: u.id, productId: y2027.id, commitmentAccepted: true }, NOW);
    const e = (await mine(u.id)).find((x) => x.productId === y2027.id)!;
    expect(e).toMatchObject({ validFrom: JAN, validUntil: YEAR_END, orderId: null, note: PRESALE_RESERVED });
    expect(await h.db.select().from(orders).where(eq(orders.userId, u.id))).toHaveLength(0); // nothing to pay now
    expect((await membershipPlacesTaken(h.db, [y2027.id], NOW)).get(y2027.id)).toBe(1);

    expect(await fees("2026-12", u.id)).toEqual([140000]); // this year's membership
    expect(await fees("2027-01", u.id)).toEqual([140000]); // the new one – the request goes out in December
    await expect(reservePresaleMembership(h.db, { userId: u.id, productId: y2027.id, commitmentAccepted: true }, NOW)).rejects.toThrow("už máš");
  });

  it("a Reformer one set up by the studio asks 2 500 Kč for January", async () => {
    const tier = await makeProduct(h.db, { kind: "membership", name: "Členství Reformer", price: 250000, validityDays: 31, includedPerMonth: 8, saleFrom: JAN, presaleFrom: NOW });
    const u = await makeUser(h.db);
    await h.db.insert(entitlements).values({ userId: u.id, kind: "membership", productId: tier.id, name: tier.name, validFrom: JAN, validUntil: YEAR_END, monthlyFee: 250000, includedPerMonth: 8, note: "Nastaveno studiem – platí od 1. 1. 2027" });
    expect(await fees("2027-01", u.id)).toEqual([250000]);
  });

  it("paid anyway (an order from before): the payment covers January, no second membership", async () => {
    const y = await makeProduct(h.db, { kind: "membership", price: 140000, validityDays: 31, saleFrom: JAN, presaleFrom: NOW });
    const u = await makeUser(h.db);
    await reservePresaleMembership(h.db, { userId: u.id, productId: y.id, commitmentAccepted: true }, NOW);
    const { order } = await createProductOrder(h.db, { userId: u.id, productId: y.id }, NOW); // reception sale
    await fulfillOrder(h.db, { orderId: order.id, provider: "cash" }, NOW);
    const rows = await mine(u.id);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ orderId: order.id, note: null, validUntil: YEAR_END });
    expect(await fees("2027-01", u.id)).toEqual([]);
  });

  it("only next year's memberships in presale can be ordered without paying", async () => {
    const now = await makeProduct(h.db, { kind: "membership", price: 140000, validityDays: 31 });
    await expect(reservePresaleMembership(h.db, { userId: (await makeUser(h.db)).id, productId: now.id, commitmentAccepted: true }, NOW)).rejects.toThrow("jen hned");
  });
});

describe("migration 0092: unpaid presale orders become memberships", () => {
  it("one per client, the orders cancelled; expired card attempts and other products stay", async () => {
    const y = await makeProduct(h.db, { kind: "membership", name: "Členství 2027", price: 140000, validityDays: 31, saleFrom: JAN, presaleFrom: NOW });
    const pass = await makeProduct(h.db, { kind: "pass", price: 129000, entries: 10, validityDays: 180 });
    const order = (userId: string, productId: string, over: Partial<typeof orders.$inferInsert> = {}) =>
      h.db.insert(orders).values({ userId, kind: "product", productId, description: "x", amount: 140000, provider: "transfer", ...over }).returning().then((r) => r[0]);
    const a = await makeUser(h.db);
    const a1 = await order(a.id, y.id);
    const a2 = await order(a.id, y.id); // clicked twice
    const b = await makeUser(h.db);
    const bCard = await order(b.id, y.id, { provider: "stripe", expiresAt: new Date(Date.now() - 3_600_000) }); // gave up paying by card
    const c = await makeUser(h.db);
    const cPass = await order(c.id, pass.id, { amount: 129000 });

    const text = readFileSync("drizzle/0092_presale_orders_reserved.sql", "utf8");
    for (const s of text.split("--> statement-breakpoint")) await h.db.execute(sql.raw(s));
    for (const s of text.split("--> statement-breakpoint")) await h.db.execute(sql.raw(s)); // safe to repeat

    const ents = await h.db.select().from(entitlements).where(and(eq(entitlements.userId, a.id), eq(entitlements.productId, y.id)));
    expect(ents).toHaveLength(1);
    expect(ents[0]).toMatchObject({ validFrom: JAN, validUntil: YEAR_END, orderId: null, note: PRESALE_RESERVED });
    const status = async (id: string) => (await h.db.select().from(orders).where(eq(orders.id, id)))[0].status;
    expect([await status(a1.id), await status(a2.id), await status(bCard.id), await status(cPass.id)]).toEqual(["cancelled", "cancelled", "pending", "pending"]);
    expect(await mine(b.id)).toHaveLength(0);
    expect(await mine(c.id)).toHaveLength(0);
    expect(await fees("2027-01", a.id)).toEqual([140000]);
  });
});
