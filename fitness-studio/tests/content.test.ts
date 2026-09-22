import { describe, expect, it } from "vitest";
import { SECTIONS, fieldDef, type SectionDef } from "@/content/definitions";

// content/index.ts is server-only; test the pure pieces
function fill(text: string, vars: Record<string, string>) {
  return text.replace(/\{\{(\w+)\}\}/g, (m, k: string) => vars[k] ?? m);
}

describe("content definitions", () => {
  it("every field has a label and image defaults point to files", () => {
    for (const [id, s] of Object.entries(SECTIONS as Record<string, SectionDef>)) {
      expect(s.title).toBeTruthy();
      for (const [name, f] of Object.entries(s.fields)) {
        expect(f.label, `${id}.${name}`).toBeTruthy();
        if (f.type === "image") expect(f.default).toMatch(/^\/(img|brand|media)\//);
      }
    }
  });
  it("resolves keys and placeholders", () => {
    expect(fieldDef("pricing.title")?.default).toContain("ceníku");
    expect(fieldDef("nope.x")).toBeUndefined();
    expect(fill(fieldDef("homeSteps.s3Text")!.default, { storno_hodin: "12" })).toContain("do 12 h");
    expect(fill("{{neznamy}}", {})).toBe("{{neznamy}}");
  });
});
