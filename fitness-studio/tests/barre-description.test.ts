import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes } from "@/db/schema";
import { templateFor } from "@/domain/lesson-templates";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const barre = async () => (await h.db.select().from(classTypes).where(eq(classTypes.slug, "barre")))[0];

describe("migration 0151: Barre isn't ballet", () => {
  it("describes Barre as strength training with ballet, pilates and DNS – and its props", async () => {
    const d = (await barre()).description;
    expect(d).toMatch(/^Barre není balet – je to posilování inspirované baletní technikou, pilates a zdravotním cvičením s prvky DNS\./);
    expect(d).toContain("u tyče, se zátěžovými míčky, gumičkou i jógovými bločky");
    // the ready-made template for a new lesson says the same
    expect(templateFor({ slug: "barre", name: "Barre" })?.description).toBe(d);
  });

  it("leaves a description the studio wrote itself alone", async () => {
    await h.db.update(classTypes).set({ description: "Vlastní popis ze studia" }).where(eq(classTypes.slug, "barre"));
    await h.db.execute(sql.raw(readFileSync("drizzle/0151_barre_description.sql", "utf8")));
    expect((await barre()).description).toBe("Vlastní popis ze studia");
  });
});
