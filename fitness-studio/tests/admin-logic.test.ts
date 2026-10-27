import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classSessions, entitlements, massageServices, orders, users } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking, setAttendance } from "@/domain/booking";
import { addAvailability, bookMassage, cancelMassage } from "@/domain/massages";
import { cancelEntitlement, createMonthlyFees, currentPeriod, shiftPeriod } from "@/domain/membership-fees";
import { createMassageOrder } from "@/domain/orders";
import { afterMemberStrike, reconsiderPause } from "@/domain/strikes";
import { pragueLocalToDate } from "@/lib/dates";
import { grantEntitlement } from "@/domain/users";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

async function member() {
  const u = await makeUser(h.db);
  await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 60 }, NOW);
  return u;
}
async function book(userId: string, startsIn: number) {
  const s = await makeSession(h.db, { startsAt: hours(startsIn), capacity: 5 });
  const m = (await bookingOptions(h.db, userId, s)).find((o) => o.method === "membership")!;
  return (await bookSession(h.db, { userId, sessionId: s.id, method: "membership", entitlementId: m.entitlementId }, NOW)).booking;
}

describe("attendance", () => {
  it("is ticked from an hour before the class; “didn't come” only after it started", async () => {
    const u = await member();
    const b = await book(u.id, 5);
    await expect(setAttendance(h.db, b.id, "attended", NOW)).rejects.toThrow(/hodinu před/);
    await expect(setAttendance(h.db, b.id, "no_show", hours(4.5))).rejects.toThrow(/po začátku/);
    expect((await setAttendance(h.db, b.id, "attended", hours(4.5))).status).toBe("attended");
    expect((await setAttendance(h.db, b.id, "no_show", hours(6))).was).toBe("attended");
  });

  it("a no-show taken back lifts the pause it caused", async () => {
    const u = await member();
    for (const at of [5, 6]) {
      const late = await book(u.id, at);
      await cancelBooking(h.db, { bookingId: late.id, actorId: u.id }, NOW);
    }
    const gone = await book(u.id, 7);
    await h.db.update(classSessions).set({ startsAt: hours(-2) }).where(eq(classSessions.id, gone.sessionId));
    await setAttendance(h.db, gone.id, "no_show", NOW);
    expect(await afterMemberStrike(h.db, u.id, NOW)).toMatchObject({ kind: "paused" });
    // still 3 strikes – the pause stays
    expect(await reconsiderPause(h.db, u.id, NOW)).toBe(false);
    await setAttendance(h.db, gone.id, "attended", NOW);
    expect(await reconsiderPause(h.db, u.id, NOW)).toBe(true);
    expect((await h.db.select().from(users).where(eq(users.id, u.id)))[0].bookingPausedUntil).toBeNull();
  });
});

describe("reception cancelling a booking", () => {
  it("an instructor can't give the entry back once the class started – an admin can", async () => {
    const u = await member();
    const b = await book(u.id, 1);
    const staff = await makeUser(h.db);
    await expect(
      cancelBooking(h.db, { bookingId: b.id, actorId: staff.id, isAdmin: true, refund: true, instructor: true }, hours(2)),
    ).rejects.toThrow(/administrátor/);
    const r = await cancelBooking(h.db, { bookingId: b.id, actorId: staff.id, isAdmin: true, refund: true }, hours(2));
    expect(r.refunded).toBe(true);
  });
});

describe("membership fees the studio called off", () => {
  it("aren't issued again by the monthly run – only for one member on purpose", async () => {
    const u = await member();
    const [fee] = await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400, userIds: [u.id] });
    await h.db.update(orders).set({ status: "cancelled" }).where(eq(orders.id, fee.id));
    expect((await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400 })).filter((o) => o.userId === u.id)).toHaveLength(0);
    expect(await createMonthlyFees(h.db, { period: "2026-11", amountKc: 1400, userIds: [u.id] })).toHaveLength(1);
  });

  it("a membership invalidated at reception owes no more months; booked classes are counted to check", async () => {
    const u = await member();
    await book(u.id, 48);
    const [e] = await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
    const [fee] = await createMonthlyFees(h.db, { period: shiftPeriod(currentPeriod(NOW), 1), amountKc: 1400, userIds: [u.id] });
    const r = await cancelEntitlement(h.db, e.id, NOW);
    expect(r.upcoming).toBe(1);
    expect((await h.db.select().from(orders).where(eq(orders.id, fee.id)))[0].status).toBe("cancelled");
  });
});

describe("massage cancelled before it's paid", () => {
  it("its payment is no longer due", async () => {
    const [svc] = await h.db.insert(massageServices).values({ name: "Masáž", slug: `m-${Math.random()}`, durationMin: 60, price: 90000 }).returning();
    await addAvailability(h.db, { date: "2026-10-06", from: "09:00", to: "12:00", weeks: 1 });
    const u = await makeUser(h.db);
    const m = await bookMassage(h.db, { userId: u.id, serviceId: svc.id, startsAt: pragueLocalToDate("2026-10-06T09:00"), payment: "transfer" }, NOW);
    const o = await createMassageOrder(h.db, { userId: u.id, bookingId: m.id });
    await cancelMassage(h.db, { bookingId: m.id, actorId: u.id }, NOW);
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0].status).toBe("cancelled");
  });
});
