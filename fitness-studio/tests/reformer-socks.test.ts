import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes } from "@/db/schema";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const migrate = async () => {
  for (const statement of readFileSync("drizzle/0167_reformer_socks.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const TIP = "Doporučujeme protiskluzové ponožky – když je nemáš, koupíš si je u nás na recepci. 🧦";
const lesson = async (slug: string, description: string) => {
  const [had] = await h.db.select().from(classTypes).where(eq(classTypes.slug, slug));
  if (had) await h.db.update(classTypes).set({ description }).where(eq(classTypes.slug, slug));
  else await h.db.insert(classTypes).values({ name: slug, slug, description });
};
const text = async (slug: string) => (await h.db.select({ d: classTypes.description }).from(classTypes).where(eq(classTypes.slug, slug)))[0].d;

describe("migration 0167: anti-slip socks tip for the Reformer lessons", () => {
  it("adds the tip to both Reformer lessons once, nowhere else", async () => {
    await lesson("reformer-fusion", "Reformer Fusion je pestrá lekce. ");
    await lesson("reformer-duo", "Reformer Duo je hodina jen pro dva.");
    await lesson("pilates-ponozky", "Pilates na podložce.");
    await migrate();
    expect(await text("reformer-fusion")).toBe(`Reformer Fusion je pestrá lekce. ${TIP}`);
    expect(await text("reformer-duo")).toBe(`Reformer Duo je hodina jen pro dva. ${TIP}`);
    expect(await text("pilates-ponozky")).toBe("Pilates na podložce.");

    // again: no second tip
    await migrate();
    expect(await text("reformer-duo")).toBe(`Reformer Duo je hodina jen pro dva. ${TIP}`);
  });

  it("leaves a description the studio already wrote about the socks", async () => {
    await lesson("reformer-fusion", "Vezmi si protiskluzové ponožky.");
    await migrate();
    expect(await text("reformer-fusion")).toBe("Vezmi si protiskluzové ponožky.");
  });
});
