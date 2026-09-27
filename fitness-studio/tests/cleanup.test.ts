import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, classSessions, entitlements, orders, users } from "@/db/schema";
import { bookSession } from "@/domain/booking";
import { deleteClient, deleteClients, deleteOrder, deleteOrders, purgeSession, seriesFrom } from "@/domain/cleanup";
import { sellAtReception } from "@/domain/orders";
import { NOW, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("cleanup", () => {
  it("deleting an order takes back what it granted", async () => {
    const u = await makeUser(h.db);
    const admin = await makeUser(h.db);
    const pass = await makeProduct(h.db, { kind: "pass", entries: 10, validityDays: 60 });
    const credit = await makeProduct(h.db, { kind: "credit_pack", credits: 1000 });
    const { order: o1 } = await sellAtReception(h.db, { userId: u.id, productId: pass.id }, NOW);
    const { order: o2 } = await sellAtReception(h.db, { userId: u.id, productId: credit.id }, NOW);
    const s = await makeSession(h.db);
    const [ent] = await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: ent.id }, NOW);

    await deleteOrder(h.db, o1.id, admin.id);
    expect(await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id))).toHaveLength(0);
    // the booking itself stays
    expect(await h.db.select().from(bookings).where(eq(bookings.userId, u.id))).toHaveLength(1);

    await deleteOrder(h.db, o2.id, admin.id);
    const [after] = await h.db.select().from(users).where(eq(users.id, u.id));
    expect(after.creditBalance).toBe(0);
    expect(await h.db.select().from(orders).where(eq(orders.userId, u.id))).toHaveLength(0);
  });

  it("bulk reset only touches chosen providers", async () => {
    const u = await makeUser(h.db);
    const admin = await makeUser(h.db);
    const p = await makeProduct(h.db, { kind: "pass", entries: 5 });
    await sellAtReception(h.db, { userId: u.id, productId: p.id }, NOW);
    const n = await deleteOrders(h.db, { providers: ["stripe"], before: new Date(+NOW + 1000), actorId: admin.id });
    expect(n).toBe(0);
    const m = await deleteOrders(h.db, { providers: ["reception"], before: new Date(+NOW + 1000), actorId: admin.id });
    expect(m).toBeGreaterThanOrEqual(1);
  });

  it("deletes a client with all their data, but not staff", async () => {
    const u = await makeUser(h.db);
    const admin = await makeUser(h.db);
    const credit = await makeProduct(h.db, { kind: "credit_pack", credits: 5 });
    await sellAtReception(h.db, { userId: u.id, productId: credit.id }, NOW);
    const s = await makeSession(h.db);
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW);
    await deleteClient(h.db, u.id, admin.id);
    expect(await h.db.select().from(users).where(eq(users.id, u.id))).toHaveLength(0);

    await h.db.update(users).set({ role: "instructor" }).where(eq(users.id, admin.id));
    await expect(deleteClient(h.db, admin.id, u.id)).rejects.toThrow(/roli/);
  });

  it("purges a class with bookings and finds the rest of its series", async () => {
    const u = await makeUser(h.db, 5);
    const series = crypto.randomUUID();
    const s1 = await makeSession(h.db, { seriesId: series });
    const s2 = await makeSession(h.db, { seriesId: series, startsAt: new Date(+s1.startsAt + 7 * 86_400_000) });
    await bookSession(h.db, { userId: u.id, sessionId: s1.id, method: "credits" }, NOW);
    expect((await seriesFrom(h.db, s1.id)).map((s) => s.id).sort()).toEqual([s1.id, s2.id].sort());
    expect((await seriesFrom(h.db, s2.id)).map((s) => s.id)).toEqual([s2.id]);
    await purgeSession(h.db, s1.id);
    expect(await h.db.select().from(classSessions).where(eq(classSessions.id, s1.id))).toHaveLength(0);
    expect(await h.db.select().from(bookings).where(eq(bookings.sessionId, s1.id))).toHaveLength(0);
  });

  it("bulk-deletes clients but never staff", async () => {
    const a = await makeUser(h.db);
    const b2 = await makeUser(h.db);
    const staff = await makeUser(h.db);
    await h.db.update(users).set({ role: "admin" }).where(eq(users.id, staff.id));
    await h.db.update(users).set({ importedAt: NOW }).where(eq(users.id, a.id));
    expect(await deleteClients(h.db, { all: true, importedOnly: true })).toBe(1);
    expect(await h.db.select().from(users).where(eq(users.id, b2.id))).toHaveLength(1);
    await deleteClients(h.db, { all: true });
    expect(await h.db.select().from(users).where(eq(users.role, "client"))).toHaveLength(0);
    expect(await h.db.select().from(users).where(eq(users.id, staff.id))).toHaveLength(1);
  });
});
