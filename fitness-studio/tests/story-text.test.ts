import { describe, expect, it } from "vitest";
import { clampLines, storyLines } from "@/lib/story-text";

describe("stories text", () => {
  it("turns rich text into plain lines", () => {
    expect(storyLines("<p>Ahoj <strong>všem</strong> &amp; vítejte</p><ul><li><p>jedna</p></li><li>dvě</li></ul><p></p>")).toEqual([
      "Ahoj všem & vítejte",
      "• jedna",
      "• dvě",
    ]);
  });

  it("keeps old plain-text posts readable", () => {
    expect(storyLines("První řádek\n\nDruhý odstavec")).toEqual(["První řádek", "Druhý odstavec"]);
  });

  it("cuts long texts on a word", () => {
    const long = "slovo ".repeat(200).trim();
    const r = clampLines(["Krátký úvod", long], 300);
    expect(r.cut).toBe(true);
    expect(r.lines[0]).toBe("Krátký úvod");
    expect(r.lines[1].endsWith("slovo…")).toBe(true);
    expect(clampLines(["a", "b"], 300)).toEqual({ lines: ["a", "b"], cut: false });
  });
});
