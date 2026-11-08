import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classSessions, classTypes, creditTransactions, orders, users, type ClassType } from "@/db/schema";
import { grantEntitlement } from "@/domain/users";
import { changeCredits } from "@/domain/wallet";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
let reformer: ClassType;
beforeAll(async () => {
  h = await testDb();
  [reformer] = await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-vs1121", memberSurcharge: 10000, nonMemberSeats: 1 }).returning();
});
afterAll(async () => h.close());

// the migration runs on the real clock (now()) – the lessons are ahead of it
const DAY = 86_400_000;
const lesson = async (inDays: number, capacity = 2) =>
  (await h.db.insert(classSessions).values({ classTypeId: reformer.id, startsAt: new Date(Date.now() + inDays * DAY), durationMin: 60, capacity, creditCost: 400, dropInPrice: 49000 }).returning())[0];

/** A member whose surcharge for one lesson came by transfer – and went back as credit when confirmed a second time. */
async function member(opts: { firstCancelled?: boolean; zeroed?: boolean } = {}) {
  const u = await makeUser(h.db);
  await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství 2026", entries: null, validityDays: 60 }, new Date());
  const first = await lesson(0.2);
  const [b] = await h.db
    .insert(bookings)
    .values({
      userId: u.id,
      sessionId: first.id,
      status: opts.firstCancelled ? "cancelled" : "confirmed",
      method: "membership",
      // settled at the desk already – or its surcharge zeroed meanwhile
      ...(opts.zeroed ? { surcharge: 0, surchargePaidAt: null } : { surcharge: 10000, surchargePaidAt: new Date() }),
    })
    .returning();
  const [o] = await h.db
    .insert(orders)
    .values({ userId: u.id, kind: "surcharge", bookingId: b.id, description: "Doplatek – Reformer fusion", amount: 10000, provider: "transfer", status: "paid", paidAt: new Date() })
    .returning();
  await changeCredits(h.db, { userId: u.id, delta: 100, reason: "refund", orderId: o.id, note: "Doplatek už nebyl potřeba – vrácen jako kredit" });
  return { u, o, b };
}

const run = async (number: number, sessionId: string) => {
  const text = readFileSync("drizzle/0150_vs1121_fix_and_15_11.sql", "utf8")
    .replace(/\b1121\b/g, String(number))
    .replaceAll("dae12072-7e55-47d1-854b-ebd8d7edb3d9", sessionId);
  for (const statement of text.split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const credit = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;
const ledger = (id: string) => h.db.select().from(creditTransactions).where(eq(creditTransactions.userId, id));
const placeOn = async (userId: string, sessionId: string) =>
  (await h.db.select().from(bookings).where(eq(bookings.userId, userId))).filter((b) => b.sessionId === sessionId);

describe("migration 0150: VS 1121's credit by mistake taken back, the place on 15. 11. given", () => {
  it("removes the credit (the surcharge was paid already) and books her in from the waitlist – surcharge to pay", async () => {
    const { u, o } = await member();
    const s = await lesson(7);
    const other = await makeUser(h.db);
    await h.db.insert(bookings).values([
      { userId: other.id, sessionId: s.id, status: "confirmed", method: "credits" },
      { userId: u.id, sessionId: s.id, status: "waitlist" },
    ]);

    await run(o.number!, s.id);
    await run(o.number!, s.id);

    expect(await credit(u.id)).toBe(0);
    expect(await ledger(u.id)).toHaveLength(0);
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0].status).toBe("paid");
    const b = await placeOn(u.id, s.id);
    expect(b).toHaveLength(1);
    expect(b[0]).toMatchObject({ status: "confirmed", method: "membership", surcharge: 10000, surchargePaidAt: null });
    expect(b[0].entitlementId).not.toBeNull();
  });

  it("a surcharge zeroed meanwhile: the lesson shows 100 Kč paid by that transfer, no credit", async () => {
    const { u, o, b } = await member({ zeroed: true });
    const s = await lesson(7);
    await run(o.number!, s.id);
    const [today] = await h.db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(today).toMatchObject({ status: "confirmed", surcharge: 10000, surchargePaidAt: o.paidAt });
    expect(await credit(u.id)).toBe(0);
    expect(await ledger(u.id)).toHaveLength(0);
    expect((await placeOn(u.id, s.id))[0]).toMatchObject({ status: "confirmed", method: "membership", surcharge: 10000, surchargePaidAt: null });
  });

  it("a refund that was right (the lesson cancelled) stays – and pays the new lesson's surcharge, as the app would", async () => {
    const { u, o } = await member({ firstCancelled: true });
    const s = await lesson(7);
    await h.db.insert(bookings).values({ userId: u.id, sessionId: s.id, status: "waitlist" });
    await run(o.number!, s.id);
    const [b] = await placeOn(u.id, s.id);
    expect(b).toMatchObject({ status: "confirmed", method: "membership", surcharge: 10000 });
    expect(b.surchargePaidAt).not.toBeNull();
    expect(await credit(u.id)).toBe(0);
    expect((await ledger(u.id)).map((t) => [t.delta, t.balanceAfter, t.note])).toEqual([
      [100, 100, "Doplatek už nebyl potřeba – vrácen jako kredit"],
      [-100, 0, "Doplatek 100 Kč zaplacen z kreditu"],
    ]);
  });

  it("a full lesson: she stays on the waitlist", async () => {
    const { u, o } = await member();
    const s = await lesson(7, 1);
    const other = await makeUser(h.db);
    await h.db.insert(bookings).values([
      { userId: other.id, sessionId: s.id, status: "confirmed", method: "credits" },
      { userId: u.id, sessionId: s.id, status: "waitlist" },
    ]);
    await run(o.number!, s.id);
    expect((await placeOn(u.id, s.id))[0].status).toBe("waitlist");
    expect(await credit(u.id)).toBe(0);
  });
});
