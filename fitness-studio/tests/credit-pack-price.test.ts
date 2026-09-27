import { describe, expect, it } from "vitest";
import { creditPackPrice } from "@/lib/money";

describe("creditPackPrice", () => {
  const pack = { kind: "credit_pack", price: 190000, credits: 2200 };
  it("prices a class by the cheapest credit pack", () => {
    expect(creditPackPrice(220, [pack])).toBe(19000);
    expect(creditPackPrice(440, [pack, { kind: "pass", price: 1, credits: null }])).toBe(38000);
  });
  it("hides nonsense while the old per-lesson credit packs are still on sale", () => {
    const old = { kind: "credit_pack", price: 200000, credits: 10 };
    expect(creditPackPrice(220, [old], 25000)).toBeNull();
    expect(creditPackPrice(220, [old, pack], 25000)).toBe(19000);
  });
  it("is null without a credit pack", () => {
    expect(creditPackPrice(220, [])).toBeNull();
  });
});
