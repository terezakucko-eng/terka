import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classSessions, users } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking, setAttendance } from "@/domain/booking";
import { afterMemberStrike, assertNotPaused, clearPause, memberStrikes } from "@/domain/strikes";
import { grantEntitlement } from "@/domain/users";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

async function memberBooking(userId: string, startsIn: number) {
  const s = await makeSession(h.db, { startsAt: hours(startsIn), capacity: 5 });
  const opts = await bookingOptions(h.db, userId, s);
  const m = opts.find((o) => o.method === "membership")!;
  return (await bookSession(h.db, { userId, sessionId: s.id, method: "membership", entitlementId: m.entitlementId }, NOW)).booking;
}

describe("member strikes", () => {
  it("late cancels and no-shows warn, then pause booking; admin can clear it", async () => {
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 60 }, NOW);

    // timely cancel = no strike
    const ok = await memberBooking(u.id, 48);
    await cancelBooking(h.db, { bookingId: ok.id, actorId: u.id }, NOW);
    expect((await memberStrikes(h.db, u.id, NOW)).strikes).toBe(0);

    // late cancel (class in 5 h, storno window 12 h)
    const late1 = await memberBooking(u.id, 5);
    await cancelBooking(h.db, { bookingId: late1.id, actorId: u.id }, NOW);
    expect(await afterMemberStrike(h.db, u.id, NOW)).toEqual({ kind: "none" });

    const late2 = await memberBooking(u.id, 6);
    await cancelBooking(h.db, { bookingId: late2.id, actorId: u.id }, NOW);
    expect(await afterMemberStrike(h.db, u.id, NOW)).toMatchObject({ kind: "warning", strikes: 2, limit: 3 });

    // no-show recorded by the studio
    const gone = await memberBooking(u.id, 7);
    await h.db.update(classSessions).set({ startsAt: hours(-2) }).where(eq(classSessions.id, gone.sessionId)); // the class is over
    await setAttendance(h.db, gone.id, "no_show");
    const out = await afterMemberStrike(h.db, u.id, NOW);
    expect(out).toMatchObject({ kind: "paused", strikes: 3, pauseDays: 7 });
    await expect(assertNotPaused(h.db, u.id, NOW)).rejects.toThrow(/pozastav|přihlašovat od/);
    expect((await memberStrikes(h.db, u.id, NOW)).strikes).toBe(0); // counting restarts after the pause

    await clearPause(h.db, u.id, NOW);
    await expect(assertNotPaused(h.db, u.id, NOW)).resolves.toBeUndefined();
    const [after] = await h.db.select().from(users).where(eq(users.id, u.id));
    expect(after.bookingPausedUntil).toBeNull();
  });
});
