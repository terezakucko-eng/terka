import { describe, expect, it } from "vitest";
import { czPlural, nextDeadline, parseCountdown, splitTime, upcomingDeadlines } from "@/lib/countdown";
import { pragueLocalToDate } from "@/lib/dates";

const at = (local: string) => pragueLocalToDate(local).getTime();

describe("countdown in the bar and the pop-up", () => {
  it("reads one end per line – a bare date runs to the end of that day, Prague time", () => {
    expect(parseCountdown("2026-11-30 | zbývá")).toEqual([{ at: at("2026-12-01T00:00"), label: "zbývá" }]);
    expect(parseCountdown("2026-11-30 18:00 | Přihlášky končí za")).toEqual([{ at: at("2026-11-30T18:00"), label: "Přihlášky končí za" }]);
    expect(parseCountdown("2026-12-24 9:30")).toEqual([{ at: at("2026-12-24T09:30"), label: "" }]);
    // the end of the year rolls over to 1 January; summer time is still Prague time
    expect(parseCountdown("2026-12-31")[0].at).toBe(at("2027-01-01T00:00"));
    expect(new Date(parseCountdown("2027-06-30 12:00")[0].at).toISOString()).toBe("2027-06-30T10:00:00.000Z");
  });

  it("skips what isn't a date and puts the earliest end first", () => {
    const list = parseCountdown("\n2026-12-31 | B\nnějaký text\n2026-11-30 | A\n31. 12. 2026 | C\n");
    expect(list.map((d) => d.label)).toEqual(["A", "B"]);
    expect(parseCountdown("")).toEqual([]);
  });

  it("counts down to the first end still ahead, then the next one, then nothing", () => {
    const list = parseCountdown("2026-11-30 | Ježíšek\n2026-12-31 | Reformer");
    expect(nextDeadline(list, at("2026-11-25T08:00"))?.label).toBe("Ježíšek");
    expect(nextDeadline(list, at("2026-11-30T23:59"))?.label).toBe("Ježíšek");
    expect(nextDeadline(list, at("2026-12-01T00:00"))?.label).toBe("Reformer");
    expect(nextDeadline(list, at("2027-01-01T00:00"))).toBeNull();
  });

  it("sends only the ends still ahead to the browser", () => {
    const text = "2026-11-30 | Ježíšek\n2026-12-31 | Reformer";
    expect(upcomingDeadlines(text, new Date(at("2026-11-25T09:00"))).map((d) => d.label)).toEqual(["Ježíšek", "Reformer"]);
    expect(upcomingDeadlines(text, new Date(at("2026-12-02T09:00"))).map((d) => d.label)).toEqual(["Reformer"]);
    expect(upcomingDeadlines(text, new Date(at("2027-01-01T00:00")))).toEqual([]);
  });

  it("splits the time left into days, hours, minutes and seconds", () => {
    expect(splitTime(((4 * 24 + 13) * 3600 + 20 * 60 + 5) * 1000 + 999)).toEqual({ d: 4, h: 13, m: 20, s: 5 });
    expect(splitTime(-5000)).toEqual({ d: 0, h: 0, m: 0, s: 0 });
  });

  it("says the units in proper Czech", () => {
    const den: [string, string, string] = ["den", "dny", "dní"];
    expect([0, 1, 2, 4, 5, 11].map((n) => czPlural(n, den))).toEqual(["dní", "den", "dny", "dny", "dní", "dní"]);
  });
});
