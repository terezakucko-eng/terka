import { describe, expect, it } from "vitest";
import { STORY_BODY, storyLayout, storyLines, wrapCount } from "@/lib/story-text";

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
    const r = storyLayout("Novinka", ["Krátký úvod", long]);
    expect(r.cut).toBe(true);
    expect(r.lines[0]).toBe("Krátký úvod");
    expect(r.lines[1].endsWith("slovo…")).toBe(true);
    expect(storyLayout("Novinka", ["a", "b"])).toEqual({ titleSize: 110, lines: ["a", "b"], cut: false });
  });

  it("wraps word by word, an emoji takes two characters", () => {
    expect(wrapCount("aaa bbb ccc", 7)).toBe(2);
    expect(wrapCount("aaa bbb ccc", 11)).toBe(1);
    expect(wrapCount("💃 ab", 4)).toBe(2);
  });

  it("a long title gets smaller and the text shorter – together they fit between the logo and the footer", () => {
    const title = "💃 Zumba SPECIAL s hosty z Olomouce – pondělí 16. 11.";
    const body = ["16. listopadu chystáme taneční večer, jaký tu ještě nebyl! Přijedou za námi lektoři Marek a Martin – a samozřejmě nebude chybět ani Tereza. 💛", ...Array(8).fill("• 17:00–17:45 Zumba Toning SPECIAL – choreografie s lehkými činkami, které zpevní celé tělo")];
    const r = storyLayout(title, body);
    expect(r.titleSize).toBeLessThan(110);
    expect(r.cut).toBe(true);
    const per = Math.floor(888 / (STORY_BODY.size * 0.53));
    const bodyHeight = r.lines.reduce((h, l, i) => h + wrapCount(l, per) * STORY_BODY.lineHeight + (i ? STORY_BODY.gap : 0), 0);
    const titleHeight = wrapCount(title, Math.floor(888 / (r.titleSize * 0.58))) * r.titleSize * 1.08;
    expect(titleHeight + 108 + bodyHeight + 76).toBeLessThanOrEqual(1040);
  });
});
