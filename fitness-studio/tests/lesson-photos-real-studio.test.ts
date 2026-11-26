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

const FILE = "drizzle/0185_lesson_photos_real_studio.sql";
const run = async () => {
  for (const statement of readFileSync(FILE, "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const PHOTOS = {
  "reformer-fusion": "d673fd7f-dfc8-457e-8ee4-8549984f693e",
  "reformer-special": "117fd947-8c54-47b5-a02b-b2f227284de7",
  "reformer-duo": "02f9fc02-5d19-470e-8f87-b5e165c21e6c",
  kettlebell: "6ee0b70d-80a7-4ef6-9c71-aedd7ea1723b",
  barre: "0206dc1f-5341-4cb8-9c38-883020bde8ed",
  "zumba-fitness": "cb251bf3-77ea-490f-8be0-1b06c6da8787",
  "zumba-toning": "562ffe25-a350-45c4-a7c9-5aa4adddbc87",
  "fitness-brunch": "b58477e4-f48c-473e-bcc1-adb332065206",
  "strong-nation": "e9a9743c-be33-4266-b698-70d6223f79be",
} as const;
const url = (k: keyof typeof PHOTOS) => `/media/${PHOTOS[k]}.webp`;
const image = async (id: string) => (await h.db.select({ u: classTypes.imageUrl }).from(classTypes).where(eq(classTypes.id, id)))[0].u;
const ai = async () => ((await h.db.select().from(settings).where(eq(settings.key, "aiImages")))[0]?.value ?? []) as string[];

describe("migration 0185: real-studio photos for nine lessons", () => {
  it("stores nine 1600×900 WebP uploads, each under the id the lessons point to", () => {
    const text = readFileSync(FILE, "utf8");
    for (const id of Object.values(PHOTOS)) expect(text).toContain(`'${id}', 'lekce-`);
  });

  it("swaps each lesson's picture once, keeps both Zdravé tělo pictures, marks the photos as AI and leaves later changes alone", async () => {
    // the state on the live web before the migration: the photos aren't uploaded yet, lessons have their old pictures
    await h.db.delete(media).where(inArray(media.id, Object.values(PHOTOS)));
    // lessons that may already exist from earlier migrations (Reformer fusion, Duo, special, Barre, …) get a known old picture
    await h.db.update(classTypes).set({ imageUrl: "/media/stara.webp" });
    const add = async (name: string, slug: string, imageUrl: string | null = "/media/stara.webp") => {
      const [found] = await h.db.select().from(classTypes).where(eq(classTypes.slug, slug));
      if (found) return found.id;
      return (await h.db.insert(classTypes).values({ name, slug, imageUrl }).returning())[0].id;
    };
    const ids = {
      "reformer-fusion": await add("Reformer fusion", "reformer-fusion"),
      "reformer-special": await add("Reformer special", "reformer-special"),
      "reformer-duo": await add("Reformer Duo", "reformer-duo"),
      kettlebell: await add("Kettlebell", "kettlebell"),
      barre: await add("Barre", "barre"),
      "zumba-fitness": await add("Zumba fitness", "zumba-fitness"),
      "zumba-toning": await add("Zumba toning", "zumba-toning", null),
      "fitness-brunch": await add("Fitness brunch", "fitness-brunch"),
      "strong-nation": await add("Strong Nation", "strong-nation-ostrava"),
    };
    const silovy = await add("Zdravé tělo | silový trénink", "zdrave-telo-silovy-trenink");
    const cardio = await add("Zdravé tělo | cardio trénink", "zdrave-telo-cardio-trenink");
    await h.db.insert(settings).values({ key: "aiImages", value: ["/media/jina.webp"] }).onConflictDoUpdate({ target: settings.key, set: { value: ["/media/jina.webp"] } });

    await run();

    for (const k of Object.keys(PHOTOS) as (keyof typeof PHOTOS)[]) expect(await image(ids[k]), k).toBe(url(k));
    expect(await image(silovy)).toBe("/media/stara.webp"); // its photo with fitness machines comes separately
    expect(await image(cardio)).toBe("/media/stara.webp");
    const rows = await h.db.select().from(media).where(inArray(media.id, Object.values(PHOTOS)));
    expect(rows).toHaveLength(9);
    for (const p of rows) {
      expect(p).toMatchObject({ mime: "image/webp", width: 1600, height: 900 });
      expect(p.data.length).toBe(p.size);
      expect(Buffer.from(p.data).subarray(8, 12).toString()).toBe("WEBP");
    }
    expect(await ai()).toEqual(["/media/jina.webp", ...Object.keys(PHOTOS).map((k) => url(k as keyof typeof PHOTOS))].sort());

    // the studio picks its own photo afterwards – running again doesn't touch it, nor duplicate anything
    await h.db.update(classTypes).set({ imageUrl: "/media/vlastni.webp" }).where(eq(classTypes.id, ids.kettlebell));
    await run();
    expect(await image(ids.kettlebell)).toBe("/media/vlastni.webp");
    expect(await ai()).toHaveLength(10);
  });
});
