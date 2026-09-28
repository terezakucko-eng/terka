import { describe, expect, it } from "vitest";
import { nbsp } from "@/lib/typography";

const N = " ";

describe("nbsp", () => {
  it("binds single-letter prepositions and conjunctions to the next word", () => {
    expect(nbsp("Cvičení v lese a u vody")).toBe(`Cvičení v${N}lese a${N}u${N}vody`);
    expect(nbsp("K lekci s kamarádkou")).toBe(`K${N}lekci s${N}kamarádkou`);
    expect(nbsp("pohybu i péče")).toBe(`pohybu i${N}péče`);
  });
  it("leaves letters inside words alone", () => {
    expect(nbsp("Bosu a Zumba")).toBe(`Bosu a${N}Zumba`);
    expect(nbsp("Vitamin C a D")).toBe(`Vitamin C a${N}D`);
  });
  it("keeps numbers with units and dashes off the line start", () => {
    expect(nbsp("Stojí 250 Kč za 10 vstupů")).toBe(`Stojí 250${N}Kč za 10${N}vstupů`);
    expect(nbsp("Lekce – 45 min")).toBe(`Lekce${N}– 45${N}min`);
    expect(nbsp("rok 2026 byl")).toBe("rok 2026 byl");
  });
  it("does not touch HTML tags", () => {
    expect(nbsp('<p class="a b">Jdu v <a href="/x">lese</a></p>')).toBe(`<p class="a b">Jdu v${N}<a href="/x">lese</a></p>`);
  });
  it("passes empty values through", () => {
    expect(nbsp("")).toBe("");
    expect(nbsp(null)).toBe(null);
  });
});
