import { describe, expect, it } from "vitest";
import { formatOpens, pragueLocalToDate } from "@/lib/dates";

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
