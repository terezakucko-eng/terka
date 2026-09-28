import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { classTypes, entitlements } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("classes costing more pass entries (Reformer = 2)", () => {
  it("takes 2 entries, gives 2 back, and refuses with only 1 left", async () => {
    const s = await makeSession(h.db, { capacity: 5 });
    await h.db.update(classTypes).set({ passEntries: 2 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    const pass = await grantEntitlement(h.db, { userId: u.id, kind: "pass", name: "Permanentka 10", entries: 10, validityDays: 60 }, NOW);

    const [opt] = await bookingOptions(h.db, u.id, s);
    expect(opt.detail).toContain("strhnou se 2 vstupy");

    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: pass.id }, NOW);
    const used = async () => (await h.db.select().from(entitlements).where(eq(entitlements.id, pass.id)))[0].entriesUsed;
    expect(await used()).toBe(2);

    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(await used()).toBe(0);

    await h.db.update(entitlements).set({ entriesUsed: 9 }).where(eq(entitlements.id, pass.id));
    await expect(
      bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: pass.id }, NOW),
    ).rejects.toThrow(/potřebuješ 2 vstupy, zbývá ti 1/);
  });

  it("the welcome free entry still counts as one", async () => {
    const s = await makeSession(h.db, { capacity: 5 });
    await h.db.update(classTypes).set({ passEntries: 2 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    const free = await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Vstup zdarma", entries: 1, validityDays: 30 }, NOW);
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "free", entitlementId: free.id }, NOW);
    const [e] = await h.db.select().from(entitlements).where(eq(entitlements.id, free.id));
    expect(e.entriesUsed).toBe(1);
  });
});

describe("classes a pass doesn't cover (individual training)", () => {
  it("refuses the pass but keeps credits", async () => {
    const s = await makeSession(h.db, { capacity: 1, creditCost: 400 });
    await h.db.update(classTypes).set({ noPass: true }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db, 400);
    const pass = await grantEntitlement(h.db, { userId: u.id, kind: "pass", name: "Permanentka 10", entries: 10, validityDays: 60 }, NOW);
    const opts = await bookingOptions(h.db, u.id, s);
    expect(opts.find((o) => o.method === "pass")?.disabled).toMatch(/neplatí/);
    expect(opts.find((o) => o.method === "credits")?.disabled).toBeUndefined();
    await expect(
      bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: pass.id }, NOW),
    ).rejects.toThrow(/neplatí/);
  });
});
