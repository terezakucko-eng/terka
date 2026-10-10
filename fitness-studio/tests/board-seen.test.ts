import { describe, expect, it } from "vitest";
import { badgeLabel, boardUnread } from "@/lib/board-seen";
import { htmlToText } from "@/lib/rich-html";

describe("'new posts' badge on the board", () => {
  const now = new Date("2026-10-10T20:00:00Z");
  const times = ["2026-10-10T19:00:00.000Z", "2026-10-08T09:00:00.000Z", "2026-09-01T10:00:00.000Z"];
  it("counts the posts newer than the last one seen", () => {
    expect(boardUnread(times, "2026-10-01T10:00:00.000Z", now)).toBe(2);
    expect(boardUnread(times, "2026-10-10T19:00:00.000Z", now)).toBe(0);
  });
  it("first visit: just 1, and only for a post from the last two weeks", () => {
    expect(boardUnread(times, null, now)).toBe(1);
    expect(boardUnread(["2026-09-01T10:00:00.000Z"], null, now)).toBe(0);
  });
  it("no posts, no badge; big numbers shown as 9+", () => {
    expect(boardUnread([], null, now)).toBe(0);
    expect([badgeLabel(3), badgeLabel(12)]).toEqual(["3", "9+"]);
  });
});

describe("push text from a board post", () => {
  it("strips the HTML and shortens it", () => {
    const html = "<p>Pojďme si užít <strong>ráno</strong> &amp; snídani!</p>\n<ul><li>8:30</li><li>jen 8 míst</li></ul>";
    expect(htmlToText(html)).toBe("Pojďme si užít ráno & snídani! 8:30 jen 8 míst");
    expect(htmlToText("<p>" + "a".repeat(200) + "</p>", 20)).toHaveLength(20);
  });
});
