import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { classTypes, entitlements, orders, users } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking, occupancy, sessionForUser } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const balance = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;

describe("bringing a friend (+1)", () => {
  it("takes two spots and double credits, refunds both", async () => {
    const s = await makeSession(h.db, { capacity: 5, creditCost: 220 });
    const u = await makeUser(h.db, 500);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits", guestName: "Jana" }, NOW);
    expect(booking.seats).toBe(2);
    expect(booking.guestName).toBe("Jana");
    expect(await occupancy(h.db, s.id)).toBe(2);
    expect(await balance(u.id)).toBe(60);

    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(await balance(u.id)).toBe(500);
    expect(await occupancy(h.db, s.id)).toBe(0);
  });

  it("takes double pass entries (Reformer 2 × 2 = 4)", async () => {
    const s = await makeSession(h.db, { capacity: 5 });
    await h.db.update(classTypes).set({ passEntries: 2 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    const pass = await grantEntitlement(h.db, { userId: u.id, kind: "pass", name: "Permanentka 10", entries: 10, validityDays: 60 }, NOW);
    const [opt] = await bookingOptions(h.db, u.id, s, 2);
    expect(opt.detail).toContain("strhnou se 4 vstupy");
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: pass.id, guestName: "Eva" }, NOW);
    const [e] = await h.db.select().from(entitlements).where(eq(entitlements.id, pass.id));
    expect(e.entriesUsed).toBe(4);
  });

  it("membership and the free entry can't pay for a friend", async () => {
    const s = await makeSession(h.db, { capacity: 5 });
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const opts = await bookingOptions(h.db, u.id, s, 2);
    expect(opts.find((o) => o.method === "membership")?.disabled).toMatch(/Kamarádku/);
  });

  it("drop-in for two uses the class type's price for two, else twice the price", async () => {
    const s = await makeSession(h.db, { capacity: 5, dropInPrice: 25000 });
    const u = await makeUser(h.db);
    let opts = await bookingOptions(h.db, u.id, s, 2);
    expect(opts.find((o) => o.method === "drop_in")?.label).toContain("500");

    await h.db.update(classTypes).set({ duoPrice: 42000 }).where(eq(classTypes.id, s.classTypeId));
    opts = await bookingOptions(h.db, u.id, s, 2);
    expect(opts.find((o) => o.method === "drop_in")?.label).toContain("420");
    const { order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true, guestName: "Petra" }, NOW);
    const [o] = await h.db.select().from(orders).where(eq(orders.id, order!.id));
    expect(o.amount).toBe(42000);
    expect(o.description).toBe("Jednorázový vstup pro dva");
  });

  it("needs two free spots and a group class", async () => {
    const s = await makeSession(h.db, { capacity: 3 });
    const a = await makeUser(h.db, 10);
    await bookSession(h.db, { userId: a.id, sessionId: s.id, method: "credits", guestName: "X" }, NOW);
    const b = await makeUser(h.db, 10);
    expect((await sessionForUser(h.db, s.id, b.id, NOW, 2))!.canBringFriend).toBe(false);
    await expect(
      bookSession(h.db, { userId: b.id, sessionId: s.id, method: "credits", guestName: "Y" }, NOW),
    ).rejects.toThrow(/Pro dva už tu není místo/);

    const solo = await makeSession(h.db, { capacity: 2 });
    await expect(
      bookSession(h.db, { userId: b.id, sessionId: solo.id, method: "credits", guestName: "Y" }, NOW),
    ).rejects.toThrow(/individuální/);
  });
});
