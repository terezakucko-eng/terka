import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classTypes } from "@/db/schema";
import { bookSession, bookingOptions } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const setRules = (id: string, v: Partial<typeof classTypes.$inferInsert>) =>
  h.db.update(classTypes).set(v).where(eq(classTypes.id, id));

describe("reformer pricing rules", () => {
  it("members pay a surcharge only from the start date", async () => {
    const before = await makeSession(h.db, { startsAt: pragueLocalToDate("2026-10-07T18:00") });
    await setRules(before.classTypeId, { memberSurcharge: 9000, memberSurchargeFrom: "2026-10-08" });
    const after = await makeSession(h.db, { classTypeId: before.classTypeId, startsAt: pragueLocalToDate("2026-10-08T18:00") });
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);

    const opts = await bookingOptions(h.db, u.id, after);
    expect(opts.find((o) => o.method === "membership")?.detail).toMatch(/doplatek 90/);
    const { booking: b1 } = await bookSession(h.db, { userId: u.id, sessionId: before.id, method: "membership", entitlementId: opts[0].entitlementId }, NOW);
    const { booking: b2 } = await bookSession(h.db, { userId: u.id, sessionId: after.id, method: "membership", entitlementId: opts[0].entitlementId }, NOW);
    const surcharge = async (id: string) => (await h.db.select().from(bookings).where(eq(bookings.id, id)))[0].surcharge;
    expect([await surcharge(b1.id), await surcharge(b2.id)]).toEqual([0, 9000]);
  });

  it("welcome free entry can't be used and the first visit has an intro price", async () => {
    const s = await makeSession(h.db, { dropInPrice: 22000 });
    await setRules(s.classTypeId, { noFreeEntry: true, firstVisitPrice: 20000 });
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Úvodní lekce zdarma", entries: 1, validityDays: 30 }, NOW);

    const opts = await bookingOptions(h.db, u.id, s);
    expect(opts.find((o) => o.method === "free")?.disabled).toMatch(/nejde/);
    expect(opts.find((o) => o.method === "drop_in")?.label).toMatch(/^První lekce 200\s*Kč$/);
    const { order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in" }, NOW);
    expect(order?.amount).toBe(20000);

    // second session of the same class: regular price again
    const next = await makeSession(h.db, { classTypeId: s.classTypeId, dropInPrice: 22000, startsAt: pragueLocalToDate("2026-10-09T18:00") });
    const opts2 = await bookingOptions(h.db, u.id, next);
    expect(opts2.find((o) => o.method === "drop_in")?.label).toMatch(/^Jednorázový vstup 220\s*Kč$/);
  });
});

describe("brunch: pass holders pay a surcharge on top of the entry", () => {
  it("takes the entries and adds the surcharge per seat; members keep their own surcharge", async () => {
    const s = await makeSession(h.db, { capacity: 8 });
    await setRules(s.classTypeId, { passSurcharge: 17000, memberSurcharge: 15000 });
    const u = await makeUser(h.db);
    const pass = await grantEntitlement(h.db, { userId: u.id, kind: "pass", name: "Permanentka 10", entries: 10, validityDays: 60 }, NOW);

    expect((await bookingOptions(h.db, u.id, s)).find((o) => o.method === "pass")?.detail).toMatch(/zbývá 10 z 10 · doplatek 170\s*Kč/);
    expect((await bookingOptions(h.db, u.id, s, 2)).find((o) => o.method === "pass")?.detail).toMatch(/doplatek 340\s*Kč/);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "pass", entitlementId: pass.id, guestName: "Petra" }, NOW);
    const [b] = await h.db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect([b.seats, b.entriesCharged, b.surcharge]).toEqual([2, 2, 34000]);

    const m = await makeUser(h.db);
    const membership = await grantEntitlement(h.db, { userId: m.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const { booking: mb } = await bookSession(h.db, { userId: m.id, sessionId: s.id, method: "membership", entitlementId: membership.id }, NOW);
    expect((await h.db.select().from(bookings).where(eq(bookings.id, mb.id)))[0].surcharge).toBe(15000);

    // credits pay the full price – nothing on top
    const c = await makeUser(h.db, 1000);
    const { booking: cb } = await bookSession(h.db, { userId: c.id, sessionId: s.id, method: "credits" }, NOW);
    expect((await h.db.select().from(bookings).where(eq(bookings.id, cb.id)))[0].surcharge).toBe(0);
  });
});
