import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classSessions, classTypes, entitlements, orders, referrals, type ClassType } from "@/db/schema";
import { makeProduct, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
let reformer: ClassType;
beforeAll(async () => {
  h = await testDb();
  [reformer] = await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-1121", passEntries: 2, nonMemberSeats: 1 }).returning();
});
afterAll(async () => h.close());

// the migration runs on the real clock (now()) – the lesson is a week ahead of it
const inAWeek = () => new Date(Date.now() + 7 * 86_400_000);
const lesson = async (capacity = 2) =>
  (await h.db.insert(classSessions).values({ classTypeId: reformer.id, startsAt: inAWeek(), durationMin: 60, capacity, creditCost: 400, dropInPrice: 49000 }).returning())[0];
const pass = (over: Partial<Parameters<typeof makeProduct>[1]> = {}) =>
  makeProduct(h.db, { kind: "pass", name: "Permanentka Reformer", price: 220000, entries: 5, validityDays: 60, classTypeId: reformer.id, ...over });
const order = async (userId: string, productId: string) =>
  (await h.db.insert(orders).values({ userId, kind: "product", productId, description: "Permanentka Reformer", amount: 220000, provider: "transfer" }).returning())[0];

/** The migration with this test's order number and lesson in place of the studio's. */
const run = async (number: number, sessionId: string) => {
  const text = readFileSync("drizzle/0150_order_1121_paid.sql", "utf8")
    .replace(/\b1121\b/g, String(number))
    .replaceAll("dae12072-7e55-47d1-854b-ebd8d7edb3d9", sessionId);
  for (const statement of text.split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const mine = (userId: string) => h.db.select().from(entitlements).where(eq(entitlements.userId, userId));
const place = async (userId: string, sessionId: string) =>
  (await h.db.select().from(bookings).where(eq(bookings.userId, userId))).filter((b) => b.sessionId === sessionId);

describe("migration 0150: the transfer for VS 1121 confirmed, the place given", () => {
  it("pays the order, grants the pass and moves her from the waitlist into the place – once", async () => {
    const s = await lesson();
    const p = await pass();
    const [client, other, friend] = [await makeUser(h.db), await makeUser(h.db), await makeUser(h.db)];
    await h.db.insert(bookings).values([
      { userId: other.id, sessionId: s.id, status: "confirmed", method: "credits" },
      { userId: client.id, sessionId: s.id, status: "waitlist" },
    ]);
    await h.db.insert(referrals).values({ referrerId: friend.id, friendId: client.id });
    const o = await order(client.id, p.id);

    await run(o.number!, s.id);
    await run(o.number!, s.id);

    const [paid] = await h.db.select().from(orders).where(eq(orders.id, o.id));
    expect(paid).toMatchObject({ status: "paid", provider: "transfer" });
    expect(paid.paidAt).not.toBeNull();
    const ents = await mine(client.id);
    expect(ents).toHaveLength(1);
    expect(ents[0]).toMatchObject({ kind: "pass", orderId: o.id, productId: p.id, name: "Permanentka Reformer", entriesTotal: 5, entriesUsed: 1, classTypeId: reformer.id });
    expect(ents[0].validUntil.getTime() - ents[0].validFrom.getTime()).toBe(60 * 86_400_000);
    // the Reformer pass takes one entry, no surcharge
    const b = await place(client.id, s.id);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ status: "confirmed", method: "pass", entitlementId: ents[0].id, entriesCharged: 1, surcharge: 0 });
    // the friend who invited her gets her gift, once
    const gifts = await mine(friend.id);
    expect(gifts).toHaveLength(1);
    expect(gifts[0]).toMatchObject({ kind: "free", name: "Lekce zdarma za pozvání 💛", entriesTotal: 1 });
    expect((await h.db.select().from(referrals).where(eq(referrals.friendId, client.id)))[0].rewardEntitlementId).toBe(gifts[0].id);
  });

  it("a full lesson: the pass is hers, she stays on the waitlist and nothing is charged", async () => {
    const s = await lesson(1);
    const p = await pass();
    const [client, other] = [await makeUser(h.db), await makeUser(h.db)];
    await h.db.insert(bookings).values([
      { userId: other.id, sessionId: s.id, status: "confirmed", method: "credits" },
      { userId: client.id, sessionId: s.id, status: "waitlist" },
    ]);
    const o = await order(client.id, p.id);
    await run(o.number!, s.id);
    expect((await mine(client.id))[0]).toMatchObject({ orderId: o.id, entriesUsed: 0 });
    expect((await place(client.id, s.id))[0]).toMatchObject({ status: "waitlist", entitlementId: null });
  });

  it("not on the waitlist: she's booked in; a general pass takes the lesson's two entries", async () => {
    const s = await lesson();
    const p = await pass({ name: "Permanentka 10 vstupů", entries: 10, classTypeId: null });
    const client = await makeUser(h.db);
    const o = await order(client.id, p.id);
    await run(o.number!, s.id);
    const [e] = await mine(client.id);
    expect(e).toMatchObject({ entriesUsed: 2, classTypeId: null });
    expect(await place(client.id, s.id)).toMatchObject([{ status: "confirmed", method: "pass", entitlementId: e.id, entriesCharged: 2 }]);
  });

  it("leaves anything that isn't an unpaid pass order alone", async () => {
    const s = await lesson();
    const credits = await makeProduct(h.db, { kind: "credit_pack", name: "Kredit", price: 100000, credits: 1000 });
    const client = await makeUser(h.db);
    await h.db.insert(bookings).values({ userId: client.id, sessionId: s.id, status: "waitlist" });
    const o = await order(client.id, credits.id);
    await run(o.number!, s.id);
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0].status).toBe("pending");
    expect(await mine(client.id)).toHaveLength(0);
    expect((await place(client.id, s.id))[0].status).toBe("waitlist");
  });
});
