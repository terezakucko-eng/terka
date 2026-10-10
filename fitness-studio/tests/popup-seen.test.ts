import { describe, expect, it } from "vitest";
import { popupDue, seenValue, weekdayIndex } from "@/lib/popup-seen";

describe("pop-up shows again on the repeat weekday", () => {
  const wed = new Date(2026, 9, 14, 10, 0); // Wednesday 14 Oct 2026, local time
  const mon = new Date(2026, 9, 12, 18, 0);

  it("reads Czech weekday names", () => {
    expect(weekdayIndex("středa")).toBe(3);
    expect(weekdayIndex("ve středu")).toBe(3);
    expect(weekdayIndex("Sobota")).toBe(6);
    expect(weekdayIndex("neděle")).toBe(0);
    expect(weekdayIndex("čtvrtek")).toBe(4);
    expect(weekdayIndex("")).toBeNull();
    expect(weekdayIndex("brzy")).toBeNull();
  });

  it("once per version, and again on Wednesday for those who closed it earlier", () => {
    expect(popupDue(null, "v1", 3, wed)).toBe(true);
    const closedMon = seenValue("v1", mon);
    expect(popupDue(closedMon, "v1", null, wed)).toBe(false); // no repeat day
    expect(popupDue(closedMon, "v1", 3, mon)).toBe(false); // same day, not Wednesday
    expect(popupDue(closedMon, "v1", 3, wed)).toBe(true); // Wednesday → back
    expect(popupDue(seenValue("v1", wed), "v1", 3, wed)).toBe(false); // closed on Wednesday → done for today
    expect(popupDue(closedMon, "v2", null, mon)).toBe(true); // new content
    expect(popupDue("v1", "v1", 3, wed)).toBe(true); // older stored format
    expect(popupDue("v1", "v1", 3, mon)).toBe(false);
  });
});
