import { describe, expect, it } from "vitest";
import { boardHasNew } from "@/lib/board-seen";
import { htmlToText } from "@/lib/rich-html";

describe("'new on the board' dot", () => {
  const now = new Date("2026-10-10T20:00:00Z");
  it("shows for a post newer than the one last seen", () => {
    expect(boardHasNew("2026-10-10T19:00:00.000Z", "2026-10-01T10:00:00.000Z", now)).toBe(true);
    expect(boardHasNew("2026-10-10T19:00:00.000Z", "2026-10-10T19:00:00.000Z", now)).toBe(false);
  });
  it("first visit: only a recent post counts", () => {
    expect(boardHasNew("2026-10-05T10:00:00.000Z", null, now)).toBe(true);
    expect(boardHasNew("2026-09-01T10:00:00.000Z", null, now)).toBe(false);
  });
  it("no posts, no dot", () => {
    expect(boardHasNew(null, null, now)).toBe(false);
  });
});

describe("push text from a board post", () => {
  it("strips the HTML and shortens it", () => {
    const html = "<p>Pojďme si užít <strong>ráno</strong> &amp; snídani!</p>\n<ul><li>8:30</li><li>jen 8 míst</li></ul>";
    expect(htmlToText(html)).toBe("Pojďme si užít ráno & snídani! 8:30 jen 8 míst");
    expect(htmlToText("<p>" + "a".repeat(200) + "</p>", 20)).toHaveLength(20);
  });
});
