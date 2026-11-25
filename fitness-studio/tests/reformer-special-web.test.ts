import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classSessions, classTypes, media, settings } from "@/db/schema";
import { upcomingForType } from "@/lib/queries";
import { NOW, hours, makeSession, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const SPECIAL = "907efc90-899b-47a0-906f-6e4b41357c27";
const PHOTO = "fde98b04-b87a-47b2-9a33-acba37c05d5d";
const run = async (file: string) => {
  for (const statement of readFileSync(`drizzle/${file}.sql`, "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const special = async () => (await h.db.select().from(classTypes).where(eq(classTypes.id, SPECIAL)))[0];
const ai = async () => (await h.db.select().from(settings).where(eq(settings.key, "aiImages")))[0]?.value as string[] | undefined;

describe("lesson page: early-open classes", () => {
  it("lists the next three weeks plus later classes whose booking is open already", async () => {
    const soon = await makeSession(h.db, { startsAt: hours(24 * 10) });
    const type = soon.classTypeId;
    const add = (over: Partial<typeof classSessions.$inferInsert> & { startsAt: Date }) =>
      h.db.insert(classSessions).values({ classTypeId: type, durationMin: 60, capacity: 2, creditCost: 1, dropInPrice: 25000, ...over }).returning().then((r) => r[0]);
    const event = await add({ startsAt: hours(24 * 60), bookingOpensAt: hours(-24) });
    await add({ startsAt: hours(24 * 61) }); // later, booking not open yet
    await add({ startsAt: hours(24 * 62), bookingOpensAt: hours(24) }); // opens tomorrow
    await add({ startsAt: hours(24 * 63), bookingOpensAt: hours(-24), status: "cancelled" });
    await makeSession(h.db, { startsAt: hours(24 * 90), bookingOpensAt: hours(-24) }); // another lesson's event

    expect((await upcomingForType(h.db, type, NOW)).map((s) => s.id)).toEqual([soon.id, event.id]);
  });
});

describe("migration 0183: Reformer special with its own photo, workbooks and a gift", () => {
  it("stores the photo as an upload", async () => {
    await run("0183_reformer_special_web");
    const [p] = await h.db.select().from(media).where(eq(media.id, PHOTO));
    expect(p).toMatchObject({ filename: "reformer-special.webp", mime: "image/webp", width: 1600, height: 900 });
    expect(p.data.length).toBe(p.size);
    expect(Buffer.from(p.data).subarray(8, 12).toString()).toBe("WEBP");
  });

  it("swaps the borrowed Reformer fusion photo and the text – not what the studio changed", async () => {
    await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-fusion", imageUrl: "/media/reformer-fusion.webp" });
    await h.db.insert(settings).values({ key: "aiImages", value: ["/media/jina.webp"] }).onConflictDoUpdate({ target: settings.key, set: { value: ["/media/jina.webp"] } });
    await run("0175_reformer_special_29_1");
    expect((await special()).imageUrl).toBe("/media/reformer-fusion.webp");

    await run("0183_reformer_special_web");
    const t = await special();
    expect(t.imageUrl).toBe(`/media/${PHOTO}.webp`);
    expect(t.description).toContain("tištěná skripta");
    expect(t.description).toContain("malý dárek");
    expect(t.description).toContain("občerstvení");
    expect(await ai()).toEqual(["/media/jina.webp", `/media/${PHOTO}.webp`].sort());

    // run again: nothing changes, the photo isn't added twice
    await run("0183_reformer_special_web");
    expect(await ai()).toHaveLength(2);

    // the studio's own photo and text stay
    await h.db.update(classTypes).set({ imageUrl: "/media/vlastni.webp", description: "Vlastní text" }).where(eq(classTypes.id, SPECIAL));
    await run("0183_reformer_special_web");
    expect(await special()).toMatchObject({ imageUrl: "/media/vlastni.webp", description: "Vlastní text" });
  });
});
