import { describe, expect, it } from "vitest";
import type { ClassSession } from "@/db/schema";
import { bookingOpensAt, sessionState } from "@/domain/booking";
import { defaultSettings } from "@/lib/settings";

const DAY = 86_400_000;
const cfg = { ...defaultSettings, bookingWindowDays: 7, memberBookingWindowDays: 14, bookingCutoffMinutes: 0 };
const now = new Date("2026-10-01T08:00:00Z");
const session = (inDays: number) =>
  ({ startsAt: new Date(now.getTime() + inDays * DAY), status: "scheduled", capacity: 10 }) as ClassSession;

describe("booking opening time", () => {
  it("matches the moment the class becomes bookable", () => {
    const s = session(10);
    const opens = bookingOpensAt(s, cfg.bookingWindowDays);
    expect(opens).toEqual(new Date(now.getTime() + 3 * DAY));
    expect(sessionState(s, 0, cfg, new Date(opens.getTime() - 1000), cfg.bookingWindowDays)).toBe("not_open");
    expect(sessionState(s, 0, cfg, opens, cfg.bookingWindowDays)).toBe("bookable");
  });

  it("members can book earlier", () => {
    const s = session(10);
    expect(sessionState(s, 0, cfg, now, cfg.memberBookingWindowDays)).toBe("bookable");
    expect(bookingOpensAt(s, cfg.memberBookingWindowDays) < now).toBe(true);
  });
});
