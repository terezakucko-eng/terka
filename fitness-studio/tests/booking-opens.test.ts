import { describe, expect, it } from "vitest";
import type { ClassSession } from "@/db/schema";
import { bookingOpensAt, sessionState, windowEnd, windowOf } from "@/domain/booking";
import { pragueLocalToDate } from "@/lib/dates";
import { defaultSettings } from "@/lib/settings";

const DAY = 86_400_000;
const session = (local: string) => ({ startsAt: pragueLocalToDate(local), status: "scheduled", capacity: 10 }) as ClassSession;

describe("booking window – calendar weeks", () => {
  const cfg = { ...defaultSettings, bookingWindowWeeks: 1, memberBookingWindowWeeks: 2, bookingCutoffMinutes: 0 };
  const wed = pragueLocalToDate("2026-10-07T10:00"); // Wednesday of the week starting Mon 5. 10.

  it("clients book this week + next, members this week + two more", () => {
    const regular = windowOf(cfg, false);
    const member = windowOf(cfg, true);
    const nextWeekSun = session("2026-10-18T18:00");
    const weekAfter = session("2026-10-20T18:00");
    expect(sessionState(nextWeekSun, 0, cfg, wed, regular)).toBe("bookable");
    expect(sessionState(weekAfter, 0, cfg, wed, regular)).toBe("not_open");
    expect(sessionState(weekAfter, 0, cfg, wed, member)).toBe("bookable");
    expect(sessionState(session("2026-10-27T18:00"), 0, cfg, wed, member)).toBe("not_open");
  });

  it("a week opens on Monday midnight (Prague)", () => {
    const weekAfter = session("2026-10-20T18:00");
    expect(bookingOpensAt(weekAfter, windowOf(cfg, false))).toEqual(pragueLocalToDate("2026-10-12T00:00"));
    expect(bookingOpensAt(weekAfter, windowOf(cfg, true))).toEqual(pragueLocalToDate("2026-10-05T00:00"));
    expect(windowEnd(windowOf(cfg, false), wed)).toEqual(pragueLocalToDate("2026-10-19T00:00"));
    expect(windowEnd(windowOf(cfg, true), wed)).toEqual(pragueLocalToDate("2026-10-26T00:00"));
  });
});

describe("booking window – rolling days (weeks set to 0)", () => {
  const cfg = { ...defaultSettings, bookingWindowWeeks: 0, bookingWindowDays: 7, memberBookingWindowDays: 14, bookingCutoffMinutes: 0 };
  const now = new Date("2026-10-01T08:00:00Z");
  const s = { startsAt: new Date(now.getTime() + 10 * DAY), status: "scheduled", capacity: 10 } as ClassSession;

  it("matches the moment the class becomes bookable", () => {
    const opens = bookingOpensAt(s, windowOf(cfg, false));
    expect(opens).toEqual(new Date(now.getTime() + 3 * DAY));
    expect(sessionState(s, 0, cfg, new Date(opens.getTime() - 1000), windowOf(cfg, false))).toBe("not_open");
    expect(sessionState(s, 0, cfg, opens, windowOf(cfg, false))).toBe("bookable");
    expect(sessionState(s, 0, cfg, now, windowOf(cfg, true))).toBe("bookable");
  });
});
