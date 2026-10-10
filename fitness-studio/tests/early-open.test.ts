import { afterAll, beforeAll, describe, expect, it } from "vitest";
import type { ClassSession } from "@/db/schema";
import { bookSession, bookingOpensAt, opensFor, sessionState, windowOf } from "@/domain/booking";
import { pragueLocalToDate } from "@/lib/dates";
import { lastEarlyOpenStart } from "@/lib/queries";
import { defaultSettings } from "@/lib/settings";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

const cfg = { ...defaultSettings, bookingWindowWeeks: 1, memberBookingWindowWeeks: 2, bookingCutoffMinutes: 0 };

describe("a class opened for booking early (brunch)", () => {
  const wed = pragueLocalToDate("2026-10-07T10:00");
  const brunch = (opens: Date | null) =>
    ({ startsAt: pragueLocalToDate("2026-10-31T08:30"), status: "scheduled", capacity: 8, bookingOpensAt: opens }) as ClassSession;

  it("its own date wins over the booking window – for everyone", () => {
    const open = brunch(pragueLocalToDate("2026-10-06T00:00"));
    expect(bookingOpensAt(open, windowOf(cfg, false))).toEqual(pragueLocalToDate("2026-10-06T00:00"));
    expect(sessionState(open, 0, cfg, wed, windowOf(cfg, false))).toBe("bookable");
    expect(opensFor(open, windowOf(cfg, false), cfg, wed)).toBeNull();
    // without it the usual window applies: not open yet
    expect(sessionState(brunch(null), 0, cfg, wed, windowOf(cfg, false))).toBe("not_open");
    // and a date still ahead keeps it closed until then
    const later = brunch(pragueLocalToDate("2026-10-08T09:00"));
    expect(sessionState(later, 0, cfg, wed, windowOf(cfg, true))).toBe("not_open");
  });
});

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("early-open class in the database", () => {
  it("can be booked far ahead and pushes the schedule horizon", async () => {
    const far = hours(24 * 40);
    const s = await makeSession(h.db, { startsAt: far, capacity: 8, bookingOpensAt: hours(-1) });
    await makeSession(h.db, { startsAt: hours(24 * 50) }); // usual class far ahead: not counted
    expect(await lastEarlyOpenStart(h.db, hours(24 * 14), NOW)).toEqual(far);
    const u = await makeUser(h.db, 5);
    const r = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW);
    expect(r.booking.status).toBe("confirmed");
  });
});
