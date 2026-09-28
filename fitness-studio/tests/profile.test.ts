import { describe, expect, it } from "vitest";
import { cleanBirthDate, cleanNameDay, displayName, formatDayMonth, parseAvatar, upcomingCelebrations } from "@/lib/profile";

describe("profile helpers", () => {
  it("shows the nickname, else the first name", () => {
    expect(displayName({ name: "Veronika Nová", nickname: "Verča" })).toBe("Verča");
    expect(displayName({ name: "Veronika Nová", nickname: " " })).toBe("Veronika");
  });

  it("parses avatars", () => {
    expect(parseAvatar("/media/abc.webp")).toEqual({ kind: "photo", url: "/media/abc.webp" });
    expect(parseAvatar("emoji:🐙")).toEqual({ kind: "emoji", emoji: "🐙" });
    expect(parseAvatar(null)).toEqual({ kind: "initials" });
  });

  it("validates birthdays and name days", () => {
    const today = new Date("2026-09-28T10:00:00Z");
    expect(cleanBirthDate("1990-05-12", today)).toBe("1990-05-12");
    expect(cleanBirthDate("1990-02-30", today)).toBeNull();
    expect(cleanBirthDate("2030-01-01", today)).toBeNull();
    expect(cleanBirthDate("", today)).toBeNull();
    expect(cleanNameDay(12, 3)).toBe("03-12");
    expect(cleanNameDay(29, 2)).toBe("02-29");
    expect(cleanNameDay(31, 4)).toBeNull();
    expect(cleanNameDay(null, 4)).toBeNull();
    expect(formatDayMonth("03-12")).toBe("12. března");
  });

  it("lists birthdays and name days in the coming days", () => {
    const people = [
      { id: "a", name: "Anna", birthDate: "1990-09-30", nameDay: "07-26" },
      { id: "b", name: "Bára", birthDate: null, nameDay: "09-28" },
      { id: "c", name: "Cecílie", birthDate: "2000-02-29", nameDay: null },
    ];
    const r = upcomingCelebrations(people, "2026-09-28", 7);
    expect(r.map((x) => [x.user.id, x.kind, x.date, x.age])).toEqual([
      ["b", "nameday", "2026-09-28", undefined],
      ["a", "birthday", "2026-09-30", 36],
    ]);
    // 29. 2. birthdays show up on 28. 2. in non-leap years
    expect(upcomingCelebrations(people, "2027-02-28", 1).map((x) => x.user.id)).toEqual(["c"]);
  });
});
