import { describe, expect, it } from "vitest";
import { nbsp, typesetProps } from "@/lib/typography";

const N = " ";

describe("nbsp", () => {
  it("binds single-letter prepositions and conjunctions to the next word", () => {
    expect(nbsp("Cvičení v lese a u vody")).toBe(`Cvičení v${N}lese a${N}u${N}vody`);
    expect(nbsp("K lekci s kamarádkou")).toBe(`K${N}lekci s${N}kamarádkou`);
    expect(nbsp("pohybu i péče")).toBe(`pohybu i${N}péče`);
  });
  it("binds short prepositions and conjunctions too, also in a row and at a sentence start", () => {
    expect(nbsp("ukázat i na webu")).toBe(`ukázat i${N}na${N}webu`);
    expect(nbsp("Na lekci pro tebe, nebo do studia")).toBe(`Na${N}lekci pro${N}tebe, nebo${N}do${N}studia`);
    expect(nbsp("Při cvičení bez bolesti")).toBe(`Při${N}cvičení bez${N}bolesti`);
  });
  it("leaves words that only start like a preposition alone", () => {
    expect(nbsp("Doma nadšení, podzim pronájem")).toBe("Doma nadšení, podzim pronájem");
  });
  it("is idempotent", () => {
    const once = nbsp("Schránku najdeš v Můj účet a na webu");
    expect(nbsp(once)).toBe(once);
  });
  it("leaves letters inside words alone", () => {
    expect(nbsp("Bosu a Zumba")).toBe(`Bosu a${N}Zumba`);
    expect(nbsp("Vitamin C a D")).toBe(`Vitamin C a${N}D`);
  });
  it("keeps numbers with units and dashes off the line start", () => {
    expect(nbsp("Stojí 250 Kč za 10 vstupů")).toBe(`Stojí 250${N}Kč za${N}10${N}vstupů`);
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

describe("typesetProps (JSX runtime)", () => {
  it("typesets text children, placeholder and title of HTML elements", () => {
    expect(typesetProps("p", { children: "Najdeš v účtu" })).toEqual({ children: `Najdeš v${N}účtu` });
    expect(typesetProps("p", { children: ["Schránku najdeš v ", 1, ["a na webu"]] })).toEqual({ children: [`Schránku najdeš v${N}`, 1, [`a${N}na${N}webu`]] });
    expect(typesetProps("textarea", { placeholder: "Napiš, co máš na srdci" }).placeholder).toBe("Napiš, co máš na srdci");
    expect(typesetProps("input", { placeholder: "např. v pondělí", title: "a v úterý" })).toEqual({ placeholder: `např. v${N}pondělí`, title: `a${N}v${N}úterý` });
  });
  it("leaves code, user input values and components alone", () => {
    const code = { children: "a v b" };
    expect(typesetProps("code", code)).toBe(code);
    const input = { value: "a v b", defaultValue: "a v b" };
    expect(typesetProps("input", input)).toBe(input);
    const comp = { children: "a v b" };
    expect(typesetProps(() => null, comp)).toBe(comp);
  });
  it("returns the same props object when nothing changes", () => {
    const props = { className: "flex a b", children: "Ahoj" };
    expect(typesetProps("div", props)).toBe(props);
  });
});
