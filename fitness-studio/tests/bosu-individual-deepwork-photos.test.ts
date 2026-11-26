import { readFileSync } from "node:fs";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, media, settings } from "@/db/schema";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const run = async () => {
  for (const statement of readFileSync("drizzle/0188_bosu_individual_deepwork_photos.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const PHOTOS = {
  bosu: "4ff2a409-72db-49c6-a00c-87c0112813fb",
  individual: "4f9694f1-5754-48b1-adb6-0123a68847c2",
  deepwork: "0fe2a225-f66c-4c7c-aa3b-0765f3ff109b",
};

describe("migration 0188: photos for BOSU, Individuální trénink and DeepWork", () => {
  it("gives each lesson its photo once, marks them as AI and leaves the studio's later choice alone", async () => {
    await h.db.delete(media).where(inArray(media.id, Object.values(PHOTOS))); // live state before the migration
    const add = async (name: string, slug: string) =>
      (await h.db.insert(classTypes).values({ name, slug, imageUrl: "/media/stara.webp" }).returning())[0].id;
    const ids = {
      bosu: await add("BOSU", "bosu"),
      individual: await add("Individuální trénink", "individualni-trenink"),
      deepwork: await add("DeepWork", "deepwork"),
    };
    const other = await add("Pilates", "pilates");
    await h.db.insert(settings).values({ key: "aiImages", value: ["/media/jina.webp"] }).onConflictDoUpdate({ target: settings.key, set: { value: ["/media/jina.webp"] } });

    await run();

    const image = async (id: string) => (await h.db.select().from(classTypes).where(eq(classTypes.id, id)))[0].imageUrl;
    for (const k of Object.keys(PHOTOS) as (keyof typeof PHOTOS)[]) expect(await image(ids[k]), k).toBe(`/media/${PHOTOS[k]}.webp`);
    expect(await image(other)).toBe("/media/stara.webp");
    const rows = await h.db.select().from(media).where(inArray(media.id, Object.values(PHOTOS)));
    expect(rows).toHaveLength(3);
    for (const p of rows) {
      expect(p).toMatchObject({ mime: "image/webp", width: 1600, height: 900 });
      expect(Buffer.from(p.data).subarray(8, 12).toString()).toBe("WEBP");
    }
    const ai = async () => (await h.db.select().from(settings).where(eq(settings.key, "aiImages")))[0].value as string[];
    expect(await ai()).toEqual(["/media/jina.webp", ...Object.values(PHOTOS).map((id) => `/media/${id}.webp`)].sort());

    await h.db.update(classTypes).set({ imageUrl: "/media/vlastni.webp" }).where(eq(classTypes.id, ids.bosu));
    await run();
    expect(await image(ids.bosu)).toBe("/media/vlastni.webp");
    expect(await ai()).toHaveLength(4);
  });
});
