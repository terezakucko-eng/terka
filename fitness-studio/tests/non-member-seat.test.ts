import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes } from "@/db/schema";
import { bookSession, cancelBooking, fillFromWaitlist, joinWaitlist, releasedHoldsWithWaitlist, sessionForUser } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { saveSettings } from "@/lib/settings";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
  await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 30, memberBookingWindowDays: 30 });
});
afterAll(async () => h.close());

const DAY = 86_400_000;
const IN_10_DAYS = new Date(NOW.getTime() + 10 * DAY);
const RELEASE = new Date(IN_10_DAYS.getTime() - 7 * DAY);

/** A Reformer-like class: one place kept for non-members until a week before. */
async function reformer(capacity: number) {
  const s = await makeSession(h.db, { capacity, startsAt: IN_10_DAYS });
  await h.db.update(classTypes).set({ nonMemberSeats: 1, nonMemberReleaseHours: 168 }).where(eq(classTypes.id, s.classTypeId));
  return s;
}
const member = async () => {
  const u = await makeUser(h.db);
  const e = await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 365 }, NOW);
  return { u, book: (sessionId: string, at = NOW) => bookSession(h.db, { userId: u.id, sessionId, method: "membership", entitlementId: e.id }, at) };
};
const guest = async () => {
  const u = await makeUser(h.db, 1000);
  return { u, book: (sessionId: string, at = NOW) => bookSession(h.db, { userId: u.id, sessionId, method: "credits" }, at) };
};

describe("a place kept for non-members", () => {
  it("members can't take the last place until a week before, a client without membership can", async () => {
    const s = await reformer(3);
    const [a, b, c] = [await member(), await member(), await member()];
    await a.book(s.id);
    await b.book(s.id);
    await expect(c.book(s.id)).rejects.toThrow("pro klienty bez členství");
    const view = (await sessionForUser(h.db, s.id, c.u.id, NOW))!;
    expect(view.state).toBe("full");
    expect(view.heldForOthersUntil).toEqual(RELEASE);
    // a non-member sees it free and books it
    const d = await guest();
    expect((await sessionForUser(h.db, s.id, d.u.id, NOW))!.state).toBe("bookable");
    await d.book(s.id);
    expect((await sessionForUser(h.db, s.id, d.u.id, NOW))!.state).toBe("full");
  });

  it("is released a week before – a member on the waitlist gets it", async () => {
    const s = await reformer(2);
    const a = await member();
    const c = await member();
    await a.book(s.id);
    await joinWaitlist(h.db, { userId: c.u.id, sessionId: s.id }, NOW);
    expect(await fillFromWaitlist(h.db, s.id, NOW)).toEqual([]);
    expect(await releasedHoldsWithWaitlist(h.db, NOW)).not.toContain(s.id);

    const later = new Date(RELEASE.getTime() + 60_000);
    expect(await releasedHoldsWithWaitlist(h.db, later)).toContain(s.id);
    const promoted = await fillFromWaitlist(h.db, s.id, later);
    expect(promoted.map((p) => p.userId)).toEqual([c.u.id]);
    // after the release a member books it directly
    const s2 = await reformer(2);
    await (await member()).book(s2.id, later);
    await expect((await member()).book(s2.id, new Date(IN_10_DAYS.getTime() - 6 * DAY))).resolves.toBeTruthy();
  });

  it("a freed place goes to a non-member on the waitlist before an earlier member", async () => {
    const s = await reformer(2);
    const d = await guest();
    const { booking } = await d.book(s.id); // takes the kept place
    await (await member()).book(s.id);
    const c = await member();
    const f = await guest();
    await joinWaitlist(h.db, { userId: c.u.id, sessionId: s.id }, NOW);
    await joinWaitlist(h.db, { userId: f.u.id, sessionId: s.id }, NOW);
    const { promoted } = await cancelBooking(h.db, { bookingId: booking.id, actorId: d.u.id }, NOW);
    expect(promoted.map((p) => p.userId)).toEqual([f.u.id]);
  });
});
