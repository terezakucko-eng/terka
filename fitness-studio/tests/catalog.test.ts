import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classSessions, classTypes, entitlements, products } from "@/db/schema";
import { deleteClassType, deleteProduct } from "@/domain/catalog";
import { createProductOrder } from "@/domain/orders";
import { activeProducts, sellableProducts } from "@/lib/queries";
import { NOW, hours, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const typeRow = async (id: string) => (await h.db.select().from(classTypes).where(eq(classTypes.id, id)))[0];
const sessionsOf = async (id: string) =>
  h.db.select().from(classSessions).where(eq(classSessions.classTypeId, id));

describe("deleting class types", () => {
  it("removes the type together with sessions nobody booked", async () => {
    const s = await makeSession(h.db);
    expect(await deleteClassType(h.db, s.classTypeId, NOW)).toBe("deleted");
    expect(await typeRow(s.classTypeId)).toBeUndefined();
    expect(await sessionsOf(s.classTypeId)).toHaveLength(0);
  });

  it("refuses while an upcoming session has live bookings", async () => {
    const s = await makeSession(h.db);
    const u = await makeUser(h.db);
    await h.db.insert(bookings).values({ userId: u.id, sessionId: s.id, status: "confirmed" });
    await expect(deleteClassType(h.db, s.classTypeId, NOW)).rejects.toThrow(/nadcházející termín/);
    expect(await typeRow(s.classTypeId)).toBeDefined();
  });

  it("archives the type when past sessions have booking history", async () => {
    const past = await makeSession(h.db, { startsAt: hours(-48) });
    const [future] = await h.db
      .insert(classSessions)
      .values({ classTypeId: past.classTypeId, startsAt: hours(72), durationMin: 60, capacity: 5, creditCost: 1 })
      .returning();
    const u = await makeUser(h.db);
    await h.db.insert(bookings).values({ userId: u.id, sessionId: past.id, status: "attended" });

    expect(await deleteClassType(h.db, past.classTypeId, NOW)).toBe("archived");
    const t = await typeRow(past.classTypeId);
    expect(t.isActive).toBe(false);
    expect(t.archivedAt).not.toBeNull();
    const left = await sessionsOf(past.classTypeId);
    expect(left.map((s) => s.id)).toEqual([past.id]);
    expect(left.some((s) => s.id === future.id)).toBe(false);
  });
});

describe("deleting products", () => {
  it("deletes unused products and archives bought ones", async () => {
    const unused = await makeProduct(h.db, { kind: "pass", entries: 5, validityDays: 30 });
    expect(await deleteProduct(h.db, unused.id, NOW)).toBe("deleted");
    expect(await h.db.select().from(products).where(eq(products.id, unused.id))).toHaveLength(0);

    const bought = await makeProduct(h.db, { kind: "pass", entries: 5, validityDays: 30 });
    const u = await makeUser(h.db);
    await h.db.insert(entitlements).values({
      userId: u.id, kind: "pass", productId: bought.id, name: "Pass", entriesTotal: 5, validFrom: NOW, validUntil: hours(24 * 30),
    });
    expect(await deleteProduct(h.db, bought.id, NOW)).toBe("archived");
    const [p] = await h.db.select().from(products).where(eq(products.id, bought.id));
    expect([p.isActive, p.archivedAt !== null]).toEqual([false, true]);
  });
});

describe("link-only products", () => {
  it("are hidden from the price list but can be bought and sold", async () => {
    const p = await makeProduct(h.db, { kind: "membership", validityDays: 30, linkOnly: true, name: "Členství pro vybrané" });
    expect((await activeProducts(h.db)).some((x) => x.id === p.id)).toBe(false);
    expect((await sellableProducts(h.db)).some((x) => x.id === p.id)).toBe(true);
    const u = await makeUser(h.db);
    const { order } = await createProductOrder(h.db, { userId: u.id, productId: p.id }, NOW);
    expect(order.productId).toBe(p.id);
  });
});
