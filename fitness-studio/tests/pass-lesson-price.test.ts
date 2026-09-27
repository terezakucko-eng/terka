import { describe, expect, it } from "vitest";
import { entriesLabel, passLessonPrice } from "@/lib/money";

describe("passLessonPrice (bodová permanentka)", () => {
  const pass10 = { kind: "pass", price: 190000, entries: 10 };
  it("prices a class by the cheapest entry pass and its entries", () => {
    expect(passLessonPrice(1, [pass10])).toBe(19000);
    expect(passLessonPrice(2, [pass10, { kind: "credit_pack", price: 1, entries: null }])).toBe(38000);
  });
  it("is null without a pass or when not cheaper than the single entry", () => {
    expect(passLessonPrice(1, [])).toBeNull();
    expect(passLessonPrice(2, [pass10], 25000)).toBeNull();
  });
  it("labels entries in Czech", () => {
    expect([1, 2, 5].map(entriesLabel)).toEqual(["1 vstup", "2 vstupy", "5 vstupů"]);
  });
});
