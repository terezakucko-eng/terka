import { describe, expect, it } from "vitest";
import { greetName, vocative } from "@/lib/vocative";

describe("vocative", () => {
  it.each([
    ["Tereza", "Terezo"], ["Jana", "Jano"], ["Terka", "Terko"], ["Báťa", "Báťo"],
    ["Marie", "Marie"], ["Lucie", "Lucie"], ["Nelly", "Nelly"], ["Miriam", "Miriam"], ["Nikol", "Nikol"],
    ["Petr", "Petře"], ["Alexandr", "Alexandře"], ["Igor", "Igore"],
    ["Jan", "Jane"], ["Adam", "Adame"], ["David", "Davide"], ["Michal", "Michale"], ["Filip", "Filipe"],
    ["Pavel", "Pavle"], ["Karel", "Karle"], ["Daniel", "Danieli"],
    ["Marek", "Marku"], ["Radek", "Radku"], ["Zdeněk", "Zdeňku"], ["Dominik", "Dominiku"], ["Vojtěch", "Vojtěchu"],
    ["Tomáš", "Tomáši"], ["Matěj", "Matěji"], ["Ondřej", "Ondřeji"], ["Alex", "Alexi"],
    ["Jiří", "Jiří"], ["Honza", "Honzo"], ["Kuba", "Kubo"],
  ])("%s → %s", (n, v) => expect(vocative(n)).toBe(v));

  it("uses the first name of a full name and leaves odd input alone", () => {
    expect(greetName("Tereza Nováková")).toBe("Terezo");
    expect(vocative("")).toBe("");
    expect(vocative("Anna-Marie")).toBe("Anna-Marie");
    expect(vocative("🐙")).toBe("🐙");
  });
});
