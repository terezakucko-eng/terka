import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, orders } from "@/db/schema";
import { studioStats } from "@/domain/stats";
import { NOW, hours, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("studio statistics", () => {
  it("counts revenue by month and group, visits, new vs returning clients and occupancy", async () => {
    const old = await makeUser(h.db);
    const fresh = await makeUser(h.db);
    // NOW = 5 Oct 2026; September and October sessions, plus one before the range
    const before = await makeSession(h.db, { startsAt: new Date("2026-01-15T17:00:00Z"), capacity: 4 });
    const sep = await makeSession(h.db, { startsAt: new Date("2026-09-14T16:00:00Z"), capacity: 4 }); // Monday 18:00 Prague
    const oct = await makeSession(h.db, { startsAt: new Date("2026-10-02T16:00:00Z"), capacity: 2 }); // Friday 18:00
    const future = await makeSession(h.db, { startsAt: hours(24), capacity: 2 });
    await h.db.insert(bookings).values([
      { userId: old.id, sessionId: before.id, status: "attended" },
      { userId: old.id, sessionId: sep.id, status: "attended" },
      { userId: fresh.id, sessionId: sep.id, status: "no_show" },
      { userId: old.id, sessionId: oct.id, status: "confirmed", seats: 2, guestName: "Jana" },
      { userId: fresh.id, sessionId: oct.id, status: "cancelled" },
      { userId: fresh.id, sessionId: future.id, status: "confirmed" },
    ]);
    const pass = await makeProduct(h.db, { kind: "pass", entries: 10 });
    const paid = { status: "paid" as const, provider: "test" };
    await h.db.insert(orders).values([
      { ...paid, userId: old.id, kind: "product", productId: pass.id, description: "P", amount: 210000, paidAt: new Date("2026-09-20T10:00:00Z") },
      { ...paid, userId: fresh.id, kind: "drop_in", description: "D", amount: 25000, paidAt: new Date("2026-10-01T10:00:00Z") },
      { ...paid, userId: fresh.id, kind: "voucher", description: "V", amount: 100000, paidAt: new Date("2026-10-03T10:00:00Z") },
      { userId: fresh.id, status: "refunded", provider: "test", kind: "drop_in", description: "R", amount: 25000, paidAt: new Date("2026-10-02T10:00:00Z") },
    ]);

    const s = await studioStats(h.db, 3, NOW);
    expect(s.periods).toEqual(["2026-08", "2026-09", "2026-10"]);
    const [aug, sepM, octM] = s.months;
    expect(aug.revenue).toBe(0);
    expect(sepM).toMatchObject({ revenue: 210000, visits: 1, clients: 1, newcomers: 0, returning: 1 });
    expect(octM).toMatchObject({ revenue: 125000, visits: 2, clients: 1 });
    expect(octM.groups).toEqual({ "Jednorázové vstupy": 25000, Poukazy: 100000 });
    expect(s.totals).toMatchObject({ revenue: 335000, visits: 3, sessions: 2, clients: 1 });
    // Sep: 2 of 4 booked (no-show counts), Oct: 2 of 2 → 4 of 6
    expect(s.totals.occupancy).toBeCloseTo(4 / 6);
    expect(s.cells.map((c) => `${c.weekday}-${c.hour}`).sort()).toEqual(["0-18", "4-18"]);
    expect(s.types).toHaveLength(2);
  });

  it("marks a client new in the month of the very first visit", async () => {
    const u = await makeUser(h.db);
    const a = await makeSession(h.db, { startsAt: new Date("2026-09-01T16:00:00Z") });
    const b = await makeSession(h.db, { startsAt: new Date("2026-10-01T16:00:00Z") });
    await h.db.insert(bookings).values([
      { userId: u.id, sessionId: a.id, status: "attended" },
      { userId: u.id, sessionId: b.id, status: "attended" },
    ]);
    const s = await studioStats(h.db, 2, NOW);
    expect(s.months.find((m) => m.period === "2026-09")!.newcomers).toBeGreaterThanOrEqual(1);
    const oct = s.months.find((m) => m.period === "2026-10")!;
    expect(oct.returning).toBeGreaterThanOrEqual(1);
  });
});
