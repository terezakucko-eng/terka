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
  for (const statement of readFileSync("drizzle/0168_reformer_basic.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const level = async (slug: string) => (await h.db.select({ l: classTypes.level }).from(classTypes).where(eq(classTypes.slug, slug)))[0].l;
const lesson = async (slug: string, l: string) => {
  const [had] = await h.db.select().from(classTypes).where(eq(classTypes.slug, slug));
  if (had) await h.db.update(classTypes).set({ level: l }).where(eq(classTypes.slug, slug));
  else await h.db.insert(classTypes).values({ name: slug, slug, level: l });
};

describe("migration 0168: Reformer fusion is Basic", () => {
  it("labels Reformer fusion Basic, not the other lessons, and keeps a level the studio set", async () => {
    await lesson("reformer-fusion", "Pro všechny");
    await lesson("reformer-duo", "Pro všechny");
    await migrate();
    expect(await level("reformer-fusion")).toBe("Basic");
    expect(await level("reformer-duo")).toBe("Pro všechny");

    await lesson("reformer-fusion", "Mírně pokročilí");
    await migrate();
    expect(await level("reformer-fusion")).toBe("Mírně pokročilí");
  });
});
