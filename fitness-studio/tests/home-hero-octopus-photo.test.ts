import { readFileSync } from "node:fs";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { content, media } from "@/db/schema";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const run = async () => {
  for (const statement of readFileSync("drizzle/0189_home_hero_octopus_photo.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const PHOTO = "3f584c4d-c98b-4163-9dd8-1cfd93246a5e";
const value = async (key: string) => (await h.db.select().from(content).where(eq(content.key, key)))[0]?.value;

describe("migration 0189: a real photo for the home page hero", () => {
  it("replaces the hero picture and its description once – a later choice of the studio stays", async () => {
    await h.db.delete(media).where(eq(media.id, PHOTO)); // live state before the migration
    await h.db.delete(content).where(inArray(content.key, ["homeHero.image", "homeHero.imageAlt"]));
    await h.db.insert(content).values([{ key: "homeHero.image", value: "/media/ai-reformer.webp" }, { key: "homeHero.caption", value: "" }]);

    await run();

    expect(await value("homeHero.image")).toBe(`/media/${PHOTO}.webp`);
    expect(await value("homeHero.imageAlt")).toContain("chobotnička");
    expect(await value("homeHero.caption")).toBe(""); // untouched
    const [p] = await h.db.select().from(media).where(eq(media.id, PHOTO));
    expect(p).toMatchObject({ mime: "image/webp", width: 1200, height: 1666 });
    expect(p.data.length).toBe(p.size);
    expect(Buffer.from(p.data).subarray(8, 12).toString()).toBe("WEBP");

    await h.db.update(content).set({ value: "/media/vlastni.webp" }).where(eq(content.key, "homeHero.image"));
    await run();
    expect(await value("homeHero.image")).toBe("/media/vlastni.webp");
  });
});
