import { describe, expect, it } from "vitest";
import { entriesLabel } from "@/lib/money";

describe("entriesLabel", () => {
  it("labels entries in Czech", () => {
    expect([1, 2, 5].map(entriesLabel)).toEqual(["1 vstup", "2 vstupy", "5 vstupů"]);
  });
});
