import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, media } from "@/db/schema";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const DUO = "d2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46";
const PHOTO = "d956393b-6b1b-48d7-8e80-74c9866bedf8";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0163_reformer_duo_photo.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const image = async () => (await h.db.select({ url: classTypes.imageUrl }).from(classTypes).where(eq(classTypes.id, DUO)))[0].url;

describe("migration 0163: Reformer Duo has its own photo", () => {
  it("stores the photo as an upload", async () => {
    const [p] = await h.db.select().from(media).where(eq(media.id, PHOTO));
    expect(p).toMatchObject({ filename: "reformer-duo.webp", mime: "image/webp", width: 1600, height: 900 });
    expect(p.data.length).toBe(p.size);
    expect(Buffer.from(p.data).subarray(8, 12).toString()).toBe("WEBP");
  });

  it("puts it on Reformer Duo instead of the Reformer fusion one – not over a photo the studio chose", async () => {
    await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-fusion", imageUrl: "/media/reformer-fusion.webp" });
    await h.db.insert(classTypes).values({ id: DUO, name: "Reformer Duo", slug: "reformer-duo", capacity: 2, imageUrl: "/media/reformer-fusion.webp" });
    await migrate();
    expect(await image()).toBe(`/media/${PHOTO}.webp`);

    await h.db.update(classTypes).set({ imageUrl: "/media/vlastni.webp" }).where(eq(classTypes.id, DUO));
    await migrate();
    expect(await image()).toBe("/media/vlastni.webp");
  });
});
