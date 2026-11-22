import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, classSessions, classTypes } from "@/db/schema";
import { pragueLocalToDate } from "@/lib/dates";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const NEWS = "a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0169_reformer_six_places.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const cap = async (id: string) => (await h.db.select({ c: classSessions.capacity }).from(classSessions).where(eq(classSessions.id, id)))[0].c;

describe("migration 0169: group Reformer for 6", () => {
  it("raises the lesson and its future 5-place sessions to 6, fixes the board text, and keeps what the studio set", async () => {
    const [had] = await h.db.select().from(classTypes).where(eq(classTypes.slug, "reformer-fusion"));
    const reformer = had
      ? (await h.db.update(classTypes).set({ capacity: 5 }).where(eq(classTypes.id, had.id)).returning())[0]
      : (await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-fusion", capacity: 5 }).returning())[0];
    const [duo] = await h.db.insert(classTypes).values({ name: "Duo", slug: "reformer-duo-test", capacity: 2 }).returning();
    const session = (typeId: string, local: string, capacity: number, status: "scheduled" | "cancelled" = "scheduled") =>
      h.db.insert(classSessions).values({ classTypeId: typeId, startsAt: pragueLocalToDate(local), durationMin: 60, capacity, creditCost: 340, status }).returning().then((r) => r[0].id);
    const past = await session(reformer.id, "2026-01-07T17:00", 5);
    const future = await session(reformer.id, "2027-01-06T17:00", 5);
    const special = await session(reformer.id, "2027-01-08T18:30", 12);
    const cancelled = await session(reformer.id, "2027-01-13T17:00", 5, "cancelled");
    const duoSession = await session(duo.id, "2027-01-05T18:00", 2);
    await h.db.insert(announcements).values({ id: NEWS, title: "Reformer", body: "<li>Cvičíme v malé skupině, nejvýš 5 lidí, takže si tě lektorka všimne pořád.</li>" }).onConflictDoNothing();
    await h.db.update(announcements).set({ body: "<li>Cvičíme v malé skupině, nejvýš 5 lidí, takže si tě lektorka všimne pořád.</li>" }).where(eq(announcements.id, NEWS));

    await migrate();
    expect((await h.db.select().from(classTypes).where(eq(classTypes.id, reformer.id)))[0].capacity).toBe(6);
    expect(await cap(future)).toBe(6);
    expect(await cap(past)).toBe(5);
    expect(await cap(special)).toBe(12);
    expect(await cap(cancelled)).toBe(5);
    expect(await cap(duoSession)).toBe(2);
    expect((await h.db.select().from(announcements).where(eq(announcements.id, NEWS)))[0].body).toContain("nejvýš 6 lidí");

    // again: nothing more; a lesson the studio set to 4 stays
    await h.db.update(classTypes).set({ capacity: 4 }).where(eq(classTypes.id, reformer.id));
    await migrate();
    expect((await h.db.select().from(classTypes).where(eq(classTypes.id, reformer.id)))[0].capacity).toBe(4);
    expect(await cap(future)).toBe(6);
  });
});
