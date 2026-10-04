import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, entitlements, users } from "@/db/schema";
import { adminAddBooking } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const used = async (id: string) => (await h.db.select().from(entitlements).where(eq(entitlements.id, id)))[0].entriesUsed;

describe("reception adds a client", () => {
  it("charges the chosen entitlement, not the first one", async () => {
    const u = await makeUser(h.db, 5);
    const s = await makeSession(h.db, { capacity: 6 });
    const pass = await grantEntitlement(h.db, { userId: u.id, kind: "pass", name: "Permanentka", entries: 10, validityDays: 30 }, NOW);
    const free = await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Vstup zdarma", entries: 2, validityDays: 30 }, NOW);
    await adminAddBooking(h.db, { sessionId: s.id, userId: u.id, pay: { method: "free", entitlementId: free.id } }, NOW);
    expect(await used(free.id)).toBe(1);
    expect(await used(pass.id)).toBe(0);
  });

  it("adds a friend and charges both spots; credit too", async () => {
    const u = await makeUser(h.db, 5);
    const s = await makeSession(h.db, { capacity: 6 });
    const pass = await grantEntitlement(h.db, { userId: u.id, kind: "pass", name: "Permanentka", entries: 10, validityDays: 30 }, NOW);
    const b = await adminAddBooking(h.db, { sessionId: s.id, userId: u.id, pay: { method: "pass", entitlementId: pass.id }, guestName: "Petra" }, NOW);
    expect(b.seats).toBe(2);
    expect(b.guestName).toBe("Petra");
    expect(await used(pass.id)).toBe(2);

    const u2 = await makeUser(h.db, 5);
    const s2 = await makeSession(h.db, { capacity: 6 });
    await adminAddBooking(h.db, { sessionId: s2.id, userId: u2.id, pay: { method: "credits" }, guestName: "Jana" }, NOW);
    const [row] = await h.db.select().from(users).where(eq(users.id, u2.id));
    expect(row.creditBalance).toBe(3);
  });

  it("refuses a membership for the friend, allows 'no charge', blocks friends on individual classes", async () => {
    const u = await makeUser(h.db);
    const s = await makeSession(h.db, { capacity: 6 });
    const m = await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    await expect(
      adminAddBooking(h.db, { sessionId: s.id, userId: u.id, pay: { method: "membership", entitlementId: m.id }, guestName: "Eva" }, NOW),
    ).rejects.toThrow(/Kamarádku/);
    const b = await adminAddBooking(h.db, { sessionId: s.id, userId: u.id, pay: "admin", guestName: "Eva" }, NOW);
    const [row] = await h.db.select().from(bookings).where(eq(bookings.id, b.id));
    expect(row.method).toBe("admin");
    expect(row.seats).toBe(2);

    const solo = await makeSession(h.db, { capacity: 1 });
    await expect(adminAddBooking(h.db, { sessionId: solo.id, userId: u.id, pay: "admin", guestName: "Eva" }, NOW)).rejects.toThrow(/individuální/);
  });
});
