import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, media } from "@/db/schema";
import { aiImageList, setAiImages } from "@/lib/ai-images";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const OLD = "/media/aef42593-3d7b-4d26-a6e6-07ee2d001857.webp";
const NEW = "/media/c79f4af0-1b0d-4d0c-9f07-dd2cc08a4dc2.webp";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0164_zumba_fitness_photo.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const image = async () => (await h.db.select({ url: classTypes.imageUrl }).from(classTypes).where(eq(classTypes.slug, "zumba-fitness")))[0].url;

describe("migration 0164: a new photo for Zumba fitness", () => {
  it("stores the photo as an upload", async () => {
    const [p] = await h.db.select().from(media).where(eq(media.id, "c79f4af0-1b0d-4d0c-9f07-dd2cc08a4dc2"));
    expect(p).toMatchObject({ filename: "zumba-fitness.webp", mime: "image/webp", width: 1600, height: 900 });
    expect(p.data.length).toBe(p.size);
    expect(Buffer.from(p.data).subarray(8, 12).toString()).toBe("WEBP");
  });

  it("replaces the old photo on the lesson and keeps its AI mark – not a photo the studio chose", async () => {
    await h.db.insert(classTypes).values({ name: "Zumba fitness", slug: "zumba-fitness", imageUrl: OLD });
    await setAiImages(h.db, [OLD, "/media/jina.webp"], true);
    await migrate();
    expect(await image()).toBe(NEW);
    expect(await aiImageList(h.db)).toEqual(["/media/aef42593-3d7b-4d26-a6e6-07ee2d001857.webp", "/media/c79f4af0-1b0d-4d0c-9f07-dd2cc08a4dc2.webp", "/media/jina.webp"]);

    // again: nothing changes; a photo the studio picked stays
    await h.db.update(classTypes).set({ imageUrl: "/media/vlastni.webp" }).where(eq(classTypes.slug, "zumba-fitness"));
    await migrate();
    expect(await image()).toBe("/media/vlastni.webp");
    expect(await aiImageList(h.db)).toHaveLength(3);
  });
});
