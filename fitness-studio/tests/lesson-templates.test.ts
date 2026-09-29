import { describe, expect, it } from "vitest";
import { LESSON_TEMPLATES, templateFor } from "@/domain/lesson-templates";

describe("lesson drafts", () => {
  it("match existing lessons by address or by name, however spelled", () => {
    expect(templateFor({ slug: "zdrave-telo-silovy", name: "Zdravé tělo | silový trénink" })?.slug).toBe("zdrave-telo-silovy-trenink");
    expect(templateFor({ slug: "zumba", name: "ZUMBA fitness" })?.name).toBe("Zumba fitness");
    expect(templateFor({ slug: "reformer-fusion", name: "Reformer" })?.name).toBe("Reformer fusion");
    expect(templateFor({ slug: "x", name: "Něco jiného" })).toBeUndefined();
  });
  it("have unique addresses and complete texts", () => {
    expect(new Set(LESSON_TEMPLATES.map((t) => t.slug)).size).toBe(LESSON_TEMPLATES.length);
    for (const t of LESSON_TEMPLATES) {
      expect(t.description.length).toBeGreaterThan(60);
      expect(t.keywords.split(",").length).toBeGreaterThan(2);
    }
  });
});
