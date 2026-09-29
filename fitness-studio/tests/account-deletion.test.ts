import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, entitlements, orders, reviews, users } from "@/db/schema";
import { bookSession, joinWaitlist } from "@/domain/booking";
import { deleteOwnAccount, deletionCheck } from "@/domain/account-deletion";
import { sellAtReception } from "@/domain/orders";
import { NOW, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("client deletes their own account", () => {
  it("without payments the account is gone and the freed place goes to the waitlist", async () => {
    const u = await makeUser(h.db, 5);
    const other = await makeUser(h.db, 5);
    const s = await makeSession(h.db, { capacity: 1 });
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW);
    await joinWaitlist(h.db, { userId: other.id, sessionId: s.id }, NOW);
    await h.db.insert(reviews).values({ userId: u.id, authorName: "Jana N.", rating: 5, body: "Skvělé lekce, doporučuji." });

    const r = await deleteOwnAccount(h.db, u.id, NOW);
    expect(r.anonymised).toBe(false);
    expect(r.promoted.map((p) => p.userId)).toEqual([other.id]);
    expect(await h.db.select().from(users).where(eq(users.id, u.id))).toHaveLength(0);
    expect(await h.db.select().from(reviews).where(eq(reviews.authorName, "Jana N."))).toHaveLength(0);
    const [ob] = await h.db.select().from(bookings).where(eq(bookings.userId, other.id));
    expect(ob.status).toBe("confirmed");
  });

  it("with payments the person is anonymised and the payments stay", async () => {
    const u = await makeUser(h.db);
    const pass = await makeProduct(h.db, { kind: "pass", entries: 10, validityDays: 60 });
    await sellAtReception(h.db, { userId: u.id, productId: pass.id }, NOW);
    await h.db.update(users).set({ phone: "+420777123456", marketingConsent: true, nickname: "Janča" }).where(eq(users.id, u.id));

    const r = await deleteOwnAccount(h.db, u.id, NOW);
    expect(r.anonymised).toBe(true);
    const [after] = await h.db.select().from(users).where(eq(users.id, u.id));
    expect(after.name).toBe("Smazaný účet");
    expect(after.email).not.toBe(u.email);
    expect(after.phone).toBeNull();
    expect(after.nickname).toBeNull();
    expect(after.marketingConsent).toBe(false);
    expect(after.deletedAt).toEqual(NOW);
    expect(await h.db.select().from(orders).where(eq(orders.userId, u.id))).toHaveLength(1);
    const [ent] = await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
    expect(ent.status).toBe("cancelled");
  });

  it("an active membership has to be ended with the studio first", async () => {
    const u = await makeUser(h.db);
    const m = await makeProduct(h.db, { kind: "membership", validityDays: 365 });
    await sellAtReception(h.db, { userId: u.id, productId: m.id }, NOW);
    expect((await deletionCheck(h.db, u.id, NOW)).blocker).toMatch(/členství/);
    await expect(deleteOwnAccount(h.db, u.id, NOW)).rejects.toThrow(/členství/);
  });
});
