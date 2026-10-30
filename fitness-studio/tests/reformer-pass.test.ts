import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, entitlements, products } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking, priorityWindow, viewerWindows, windowOf } from "@/domain/booking";
import { membershipPlacesTaken, placesLeft } from "@/domain/membership-fees";
import { createProductOrder, fulfillOrder } from "@/domain/orders";
import { giftableProducts } from "@/domain/vouchers";
import { pragueLocalToDate } from "@/lib/dates";
import { getSettings } from "@/lib/settings";
import { NOW, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const buy = async (productId: string) => {
  const u = await makeUser(h.db);
  const { order } = await createProductOrder(h.db, { userId: u.id, productId, commitmentAccepted: true }, NOW);
  await fulfillOrder(h.db, { orderId: order.id, provider: "test" }, NOW);
  const [e] = await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
  return { u, e };
};

describe("Permanentka Reformer – a pass just for one class", () => {
  it("is one entry a lesson, with no pass surcharge, and only for its class", async () => {
    const s = await makeSession(h.db, { capacity: 5 });
    // ordinary passes: Reformer costs 2 entries and a surcharge
    await h.db.update(classTypes).set({ passEntries: 2, passSurcharge: 10000, noPass: true }).where(eq(classTypes.id, s.classTypeId));
    const pass = await makeProduct(h.db, { kind: "pass", name: "Permanentka Reformer", entries: 5, validityDays: 60, classTypeId: s.classTypeId });
    const { u, e } = await buy(pass.id);
    expect(e).toMatchObject({ kind: "pass", classTypeId: s.classTypeId, entriesTotal: 5 });

    const [opt] = await bookingOptions(h.db, u.id, s);
    expect(opt).toMatchObject({ method: "pass", entitlementId: e.id });
    expect(opt.disabled).toBeUndefined();
    expect(opt.detail).not.toContain("strhnou se");

    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: e.id }, NOW);
    expect(booking.surcharge).toBe(0);
    const used = async () => (await h.db.select().from(entitlements).where(eq(entitlements.id, e.id)))[0].entriesUsed;
    expect(await used()).toBe(1);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(await used()).toBe(0);

    const other = await makeSession(h.db, { capacity: 5 });
    await expect(bookSession(h.db, { userId: u.id, sessionId: other.id, method: "pass", entitlementId: e.id }, NOW)).rejects.toThrow("jen na jinou lekci");
  });

  it("books its class as early as Členství Reformer, until it's used up", async () => {
    const cfg = await getSettings(h.db);
    const later = await makeSession(h.db, { capacity: 6, startsAt: pragueLocalToDate("2026-10-28T17:00") });
    const elsewhere = await makeSession(h.db, { capacity: 6, startsAt: pragueLocalToDate("2026-10-28T18:00") });
    const pass = await makeProduct(h.db, { kind: "pass", name: "Permanentka Reformer", entries: 2, validityDays: 60, classTypeId: later.classTypeId });
    const { u, e } = await buy(pass.id);

    expect((await viewerWindows(h.db, cfg, u.id, NOW)).forSession(later)).toEqual(priorityWindow(cfg));
    expect((await viewerWindows(h.db, cfg, u.id, NOW)).forSession(elsewhere)).toEqual(windowOf(cfg, false));
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: later.id, method: "pass", entitlementId: e.id }, NOW);
    expect(booking.status).toBe("confirmed");

    await h.db.update(entitlements).set({ entriesUsed: 2 }).where(eq(entitlements.id, e.id));
    expect((await viewerWindows(h.db, cfg, u.id, NOW)).forSession(later)).toEqual(windowOf(cfg, false));
  });

  it("takes a place from Členství Reformer and gives it back when used up", async () => {
    const s = await makeSession(h.db);
    const tier = await makeProduct(h.db, { kind: "membership", name: "Členství Reformer", price: 250000, validityDays: 365, includedClassTypeId: s.classTypeId, includedPerMonth: 8, maxActive: 3 });
    const pass = await makeProduct(h.db, { kind: "pass", name: "Permanentka Reformer", entries: 5, validityDays: 60, classTypeId: s.classTypeId, sharesPlacesWith: tier.id });
    const left = async () => Object.fromEntries(await placesLeft(h.db, [tier, pass], NOW));

    await buy(tier.id);
    expect(await left()).toEqual({ [tier.id]: 2, [pass.id]: 2 });
    const { e } = await buy(pass.id);
    // an order still waiting for payment holds a place too
    const waiting = await makeUser(h.db);
    const { order } = await createProductOrder(h.db, { userId: waiting.id, productId: pass.id }, NOW);
    expect(await left()).toEqual({ [tier.id]: 0, [pass.id]: 0 });
    expect((await membershipPlacesTaken(h.db, [tier.id], NOW)).get(tier.id)).toBe(3);

    await expect(createProductOrder(h.db, { userId: (await makeUser(h.db)).id, productId: tier.id, commitmentAccepted: true }, NOW)).rejects.toThrow("omezený počet členství");
    await expect(createProductOrder(h.db, { userId: (await makeUser(h.db)).id, productId: pass.id }, NOW)).rejects.toThrow("omezený počet míst");

    // used up: the place is free again
    await h.db.update(entitlements).set({ entriesUsed: 5 }).where(eq(entitlements.id, e.id));
    expect(await left()).toEqual({ [tier.id]: 1, [pass.id]: 1 });
    await fulfillOrder(h.db, { orderId: order.id, provider: "test" }, NOW);
    expect(await left()).toEqual({ [tier.id]: 1, [pass.id]: 1 });
    await expect(createProductOrder(h.db, { userId: (await makeUser(h.db)).id, productId: tier.id, commitmentAccepted: true }, NOW)).resolves.toMatchObject({ product: { id: tier.id } });
    await h.db.update(products).set({ isActive: false }).where(eq(products.id, tier.id));
  });

  it("can't be given as a voucher – it would skip the limit", async () => {
    const s = await makeSession(h.db);
    const tier = await makeProduct(h.db, { kind: "membership", name: "Členství Reformer", price: 250000, maxActive: 3 });
    const pass = await makeProduct(h.db, { kind: "pass", name: "Permanentka Reformer", entries: 5, classTypeId: s.classTypeId, sharesPlacesWith: tier.id });
    const plain = await makeProduct(h.db, { kind: "pass", name: "Permanentka 10", entries: 10 });
    const ids = (await giftableProducts(h.db)).map((p) => p.id);
    expect(ids).toContain(plain.id);
    expect(ids).not.toContain(pass.id);
  });
});

describe("migration 0118: Permanentka Reformer", () => {
  it("is created hidden, just for Reformer fusion and taking places from Členství Reformer", async () => {
    const run = async () => h.db.execute(sql.raw(readFileSync("drizzle/0118_reformer_pass_product.sql", "utf8")));
    const find = () => h.db.select().from(products).where(eq(products.id, "6bdbf271-9d5f-4260-b60b-946da3e254db"));
    await run(); // a fresh database without the class or the membership: nothing to create
    expect(await find()).toEqual([]);

    const [ct] = await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-fusion" }).onConflictDoNothing().returning();
    await h.db
      .insert(products)
      .values({ id: "b09203a4-b468-4653-be2b-01d41922d888", kind: "membership", name: "Členství Reformer", price: 250000, maxActive: 3, includedClassTypeId: ct.id, includedPerMonth: 8 })
      .onConflictDoNothing();
    await run();
    await run(); // safe to repeat
    const rows = await find();
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      kind: "pass",
      name: "Permanentka Reformer",
      price: 349000,
      entries: 8,
      validityDays: 45,
      isActive: false,
      saleFrom: null,
      saleUntil: null,
      classTypeId: ct.id,
      sharesPlacesWith: "b09203a4-b468-4653-be2b-01d41922d888",
    });
  });
});
