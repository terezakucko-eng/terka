import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, classSessions, classTypes, media, settings } from "@/db/schema";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const run = async (file: string) => {
  for (const statement of readFileSync(`drizzle/${file}.sql`, "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const PHOTO = "25cb3853-9af9-4802-98a3-e31daf62e750";
const POST = "7dd69a80-20af-42b8-82c5-4418514e62e6";
const AT = new Date("2026-11-29T17:00:00Z");

describe("migration 0187: Zdravé tělo with fitness machines, Sunday's Zumba with Terka and Kiki", () => {
  it("gives Zdravé tělo | silový trénink its new photo once – not the cardio lesson, not a later choice of the studio", async () => {
    await h.db.delete(media).where(eq(media.id, PHOTO)); // live state before the migration
    const [silovy] = await h.db.insert(classTypes).values({ name: "Zdravé tělo | silový trénink", slug: "zdrave-telo-silovy", imageUrl: "/media/stara.webp" }).returning();
    const [cardio] = await h.db.insert(classTypes).values({ name: "Zdravé tělo | cardio trénink", slug: "zdrave-telo-cardio", imageUrl: "/media/stara.webp" }).returning();
    await h.db.insert(settings).values({ key: "aiImages", value: [] }).onConflictDoUpdate({ target: settings.key, set: { value: [] } });

    await run("0187_zdrave_telo_stroje_terka_kiki");

    const image = async (id: string) => (await h.db.select().from(classTypes).where(eq(classTypes.id, id)))[0].imageUrl;
    expect(await image(silovy.id)).toBe(`/media/${PHOTO}.webp`);
    expect(await image(cardio.id)).toBe("/media/stara.webp");
    const [p] = await h.db.select().from(media).where(eq(media.id, PHOTO));
    expect(p).toMatchObject({ mime: "image/webp", width: 1600, height: 900 });
    expect(Buffer.from(p.data).subarray(8, 12).toString()).toBe("WEBP");
    expect((await h.db.select().from(settings).where(eq(settings.key, "aiImages")))[0].value).toEqual([`/media/${PHOTO}.webp`]);

    await h.db.update(classTypes).set({ imageUrl: "/media/vlastni.webp" }).where(eq(classTypes.id, silovy.id));
    await run("0187_zdrave_telo_stroje_terka_kiki");
    expect(await image(silovy.id)).toBe("/media/vlastni.webp");
  });

  it("renames Sunday's class and its board post – only what still carries the old name", async () => {
    const [zumba] = await h.db.insert(classTypes).values({ name: "Zumba fitness", slug: "zumba-fitness" }).returning();
    const [s] = await h.db
      .insert(classSessions)
      .values({ classTypeId: zumba.id, startsAt: AT, durationMin: 60, capacity: 14, creditCost: 1, dropInPrice: 25000 })
      .returning();
    await h.db.delete(announcements).where(eq(announcements.id, POST));
    await run("0186_zumba_s_kikinou");
    await run("0187_zdrave_telo_stroje_terka_kiki");
    await run("0187_zdrave_telo_stroje_terka_kiki");

    expect((await h.db.select().from(classSessions).where(eq(classSessions.id, s.id)))[0].title).toBe("Zumba fitness s Terkou a Kiki");
    const [post] = await h.db.select().from(announcements).where(eq(announcements.id, POST));
    expect(post.title).toBe("💃 Zumba fitness s Terkou a Kiki – neděle 29. 11. v 18:00");
    expect(post.body).toContain("Krista Světnická – Kiki</strong>");
    expect(post.body).toContain("spolu s Terkou");
    expect(post.body).not.toContain("Kikina");
    expect(post.body).toContain(`/rozvrh/${s.id}`);

    // the studio's own title stays
    await h.db.update(classSessions).set({ title: "Vlastní" }).where(eq(classSessions.id, s.id));
    await run("0187_zdrave_telo_stroje_terka_kiki");
    expect((await h.db.select().from(classSessions).where(eq(classSessions.id, s.id)))[0].title).toBe("Vlastní");
  });
});
