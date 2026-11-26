import { readFileSync } from "node:fs";
import { eq, inArray, like, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { content, media } from "@/db/schema";
import { fieldDef } from "@/content/definitions";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const run = async () => {
  for (const statement of readFileSync("drizzle/0190_home_hero_slides.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const PHOTOS = ["bd77a3a9-60a6-42b5-8826-0cada30f3feb", "af8ddd49-b1ac-457e-95f3-b612397d7c23", "0a955fdd-a3b6-4234-9d0c-22cf0bbda76a", "2fa4701d-891e-4ddd-8641-b30473375e59"];
const OCTO = "/media/3f584c4d-c98b-4163-9dd8-1cfd93246a5e.webp";
const value = async (key: string) => (await h.db.select().from(content).where(eq(content.key, key)))[0]?.value;
const reset = async (hero: string | null) => {
  await h.db.delete(media).where(inArray(media.id, PHOTOS));
  await h.db.delete(content).where(like(content.key, "homeHero.%"));
  if (hero) await h.db.insert(content).values({ key: "homeHero.image", value: hero });
};

describe("home hero: up to four photos that take turns", () => {
  it("has optional slots for more photos, empty by default", () => {
    for (const n of [2, 3, 4]) {
      expect(fieldDef(`homeHero.image${n}`)).toMatchObject({ type: "image", default: "", optional: true });
      expect(fieldDef(`homeHero.imageAlt${n}`)).toMatchObject({ default: "", optional: true });
    }
  });

  it("migration 0190 swaps the octopus for four real photos once", async () => {
    await reset(OCTO); // live state: the octopus from 0189
    await run();
    expect(await value("homeHero.image")).toBe(`/media/${PHOTOS[0]}.webp`);
    expect(await value("homeHero.image2")).toBe(`/media/${PHOTOS[1]}.webp`);
    expect(await value("homeHero.image3")).toBe(`/media/${PHOTOS[2]}.webp`);
    expect(await value("homeHero.image4")).toBe(`/media/${PHOTOS[3]}.webp`);
    for (const n of ["", "2", "3", "4"]) expect(await value(`homeHero.imageAlt${n}`)).toBeTruthy();
    const rows = await h.db.select().from(media).where(inArray(media.id, PHOTOS));
    expect(rows).toHaveLength(4);
    for (const p of rows) {
      expect(p).toMatchObject({ mime: "image/webp", width: 1200 });
      expect(p.data.length).toBe(p.size);
      expect(Buffer.from(p.data).subarray(8, 12).toString()).toBe("WEBP");
    }

    // the studio's own choice afterwards stays
    await h.db.update(content).set({ value: "/media/vlastni.webp" }).where(eq(content.key, "homeHero.image2"));
    await run();
    expect(await value("homeHero.image2")).toBe("/media/vlastni.webp");
  });

  it("leaves a hero photo the studio picked instead of the octopus alone", async () => {
    await reset("/media/vlastni-uvod.webp");
    await run();
    expect(await value("homeHero.image")).toBe("/media/vlastni-uvod.webp");
    expect(await value("homeHero.image2")).toBeUndefined();
  });
});
