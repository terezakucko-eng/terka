import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, classSessions, classTypes } from "@/db/schema";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const run = async () => {
  for (const statement of readFileSync("drizzle/0186_zumba_s_kikinou.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const AT = new Date("2026-11-29T17:00:00Z"); // 18:00 in Prague
const POST = "7dd69a80-20af-42b8-82c5-4418514e62e6";

describe("migration 0186: Zumba fitness s Kikinou on Sunday 29 Nov at 18:00", () => {
  it("creates the class when it isn't in the schedule yet, with a pinned board post linking to it – once", async () => {
    const [zumba] = await h.db
      .insert(classTypes)
      .values({ name: "Zumba fitness", slug: "zumba-fitness", durationMin: 60, capacity: 14, creditCost: 1, dropInPrice: 25000 })
      .returning();
    const base = { classTypeId: zumba.id, durationMin: 60, capacity: 14, creditCost: 1, dropInPrice: 25000 };
    await h.db.delete(announcements).where(eq(announcements.id, POST)); // the test DB ran 0186 before the lesson existed
    await h.db.insert(classSessions).values({ ...base, startsAt: new Date("2026-11-23T17:00:00Z"), room: "Velký sál" });

    await run();
    await run();

    const at = await h.db.select().from(classSessions).where(and(eq(classSessions.classTypeId, zumba.id), eq(classSessions.startsAt, AT)));
    expect(at).toHaveLength(1);
    expect(at[0]).toMatchObject({ title: "Zumba fitness s Kikinou", durationMin: 60, capacity: 14, room: "Velký sál", status: "scheduled" });
    const posts = await h.db.select().from(announcements).where(eq(announcements.id, POST));
    expect(posts).toHaveLength(1);
    expect(posts[0]).toMatchObject({ isPinned: true, isPublished: true });
    expect(posts[0].title).toContain("Kikinou");
    expect(posts[0].body).toContain("Krista Světnická");
    expect(posts[0].body).toContain(`href="/rozvrh/${at[0].id}"`);
  });

  it("names a class the studio already scheduled – not one with its own title", async () => {
    const h2 = await testDb();
    try {
      const [zumba] = await h2.db.insert(classTypes).values({ name: "Zumba fitness", slug: "zumba-fitness" }).returning();
      const base = { classTypeId: zumba.id, durationMin: 60, capacity: 14, creditCost: 1, dropInPrice: 25000, startsAt: AT };
      const [own] = await h2.db.insert(classSessions).values(base).returning();
      await h2.db.delete(announcements).where(eq(announcements.id, POST));
      for (const statement of readFileSync("drizzle/0186_zumba_s_kikinou.sql", "utf8").split("--> statement-breakpoint")) await h2.db.execute(sql.raw(statement));
      const rows = await h2.db.select().from(classSessions).where(eq(classSessions.classTypeId, zumba.id));
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ id: own.id, title: "Zumba fitness s Kikinou" });
      expect((await h2.db.select().from(announcements).where(eq(announcements.id, POST)))[0].body).toContain(`/rozvrh/${own.id}`);

      // a Zumba under a slightly different lesson name at the same time counts too – no second class is created
      const [special] = await h2.db.insert(classTypes).values({ name: "Zumba fitness SPECIAL", slug: "zumba-special" }).returning();
      await h2.db.update(classSessions).set({ classTypeId: special.id, title: null }).where(eq(classSessions.id, own.id));
      for (const statement of readFileSync("drizzle/0186_zumba_s_kikinou.sql", "utf8").split("--> statement-breakpoint")) await h2.db.execute(sql.raw(statement));
      expect(await h2.db.select().from(classSessions).where(eq(classSessions.startsAt, AT))).toMatchObject([{ id: own.id, title: "Zumba fitness s Kikinou" }]);

      await h2.db.update(classSessions).set({ title: "Vlastní název" }).where(eq(classSessions.id, own.id));
      for (const statement of readFileSync("drizzle/0186_zumba_s_kikinou.sql", "utf8").split("--> statement-breakpoint")) await h2.db.execute(sql.raw(statement));
      expect((await h2.db.select().from(classSessions).where(eq(classSessions.id, own.id)))[0].title).toBe("Vlastní název");
    } finally {
      await h2.close();
    }
  });
});
