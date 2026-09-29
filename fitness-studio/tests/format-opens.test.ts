import { describe, expect, it } from "vitest";
import { formatOpens, pragueLocalToDate } from "@/lib/dates";
import { opensFor, windowOf } from "@/domain/booking";
import { defaultSettings } from "@/lib/settings";

describe("formatOpens", () => {
  it("a new week opening at midnight reads as a plain date", () => {
    expect(formatOpens(pragueLocalToDate("2026-10-05T00:00"))).toBe("5.\u00a010.");
    expect(formatOpens(pragueLocalToDate("2026-10-05T00:00"), true)).toBe("pondělí 5.\u00a010.");
  });
  it("other times keep the hour, weekdays read after 'od'", () => {
    expect(formatOpens(pragueLocalToDate("2026-10-07T18:00"), true)).toBe("středy 7.\u00a010. v\u00a018:00");
    expect(formatOpens(pragueLocalToDate("2026-10-08T07:30"))).toBe("8.\u00a010. v\u00a007:30");
  });
});

describe("opensFor", () => {
  const cfg = { ...defaultSettings, bookingWindowWeeks: 1, memberBookingWindowWeeks: 2 };
  const now = pragueLocalToDate("2026-09-30T10:00");
  const regular = windowOf(cfg, false);
  it("third week: members already, others from Monday", () => {
    const o = opensFor({ startsAt: pragueLocalToDate("2026-10-14T18:00") }, regular, cfg, now);
    expect(o?.membersNow).toBe(true);
    expect(o?.at).toEqual(pragueLocalToDate("2026-10-05T00:00"));
  });
  it("fourth week: not open for anyone yet", () => {
    const o = opensFor({ startsAt: pragueLocalToDate("2026-10-21T18:00") }, regular, cfg, now);
    expect(o?.membersNow).toBe(false);
  });
  it("next week is bookable", () => {
    expect(opensFor({ startsAt: pragueLocalToDate("2026-10-07T18:00") }, regular, cfg, now)).toBeNull();
  });
});
