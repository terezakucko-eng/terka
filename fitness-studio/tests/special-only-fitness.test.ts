import { readFileSync } from "node:fs";
import { eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, classSessions, content, media } from "@/db/schema";
import { hours, makeSession, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const TONING = "5ea2983c-b146-45ae-b4b6-f86c43acc4c4";
const FITNESS = "00d2c63c-54d6-4248-a5a0-842b458b2e96";
const POST = "146aa9e2-80ab-437c-b082-47ecb7403616";
const NOTE =
  "Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou. Členové ji mají v ceně, bez placení. Ostatní ji uhradí permanentkou, kredity nebo jednorázově. Jdeš na obě? Balíček Toning + fitness vyjde na 300 Kč (kartou nebo převodem). Vstupy zdarma, včetně úvodního pro nováčky, tu neplatí.";

const migrate = async () => {
  for (const statement of readFileSync("drizzle/0155_special_only_fitness.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const texts = async () => Object.fromEntries((await h.db.select().from(content)).map((r) => [r.key, r.value]));
const setText = (key: string, value: string) => h.db.update(content).set({ value }).where(eq(content.key, key));
const post = async () => (await h.db.select().from(announcements).where(eq(announcements.id, POST)))[0].body;
const note = async () => (await h.db.select().from(classSessions).where(eq(classSessions.id, FITNESS)))[0].note;

describe("migration 0155: the Zumba SPECIAL evening with the fitness at 18:00 only", () => {
  it("does nothing where the event isn't in the schedule (a fresh database)", async () => {
    const before = [await texts(), await post()];
    await migrate();
    expect([await texts(), await post()]).toEqual(before);
    expect(before[1]).toContain(`/rozvrh/${TONING}`);
  });

  it("nor while the Toning still takes place", async () => {
    await makeSession(h.db, { id: FITNESS, startsAt: hours(60), title: "Zumba fitness SPECIAL", note: NOTE, noFreeEntry: true });
    await makeSession(h.db, { id: TONING, startsAt: hours(59), title: "Zumba Toning SPECIAL", note: NOTE, noFreeEntry: true });
    // the bar and the pop-up as the studio had them (before 0161 put membership back in the bar)
    await setText("promoBar.text", "💃 Pondělí 16. 11.2026 - Zumba a Toning SPECIAL s Márou, Marťou a Terkou!");
    await setText("promoBar.linkUrl", `/nastenka#${POST}`);
    await setText("popup.title", "💃 Zumba a Toning SPECIAL s Márou, Marťou a Terkou – pondělí 16. 11.");
    await setText("popup.buttonLabel2", "Rezervovat Zumbu 18:00");
    const before = [await texts(), await post(), await note()];
    await migrate();
    expect([await texts(), await post(), await note()]).toEqual(before);
  });

  it("with the Toning off the schedule, nothing on the web invites to it or sells both lessons", async () => {
    await h.db.delete(classSessions).where(eq(classSessions.id, TONING));
    await migrate();

    expect(await note()).toBe(
      "Speciální lekce s hostujícími lektory Markem a Martinem z Olomouce – a samozřejmě s Terezou. Členové ji mají v ceně, bez placení. Ostatní ji uhradí permanentkou, kredity nebo jednorázově. Vstupy zdarma, včetně úvodního pro nováčky, tu neplatí.",
    );

    const body = await post();
    expect(body).not.toMatch(/5ea2983c|balicek|300 Kč|17:00–17:45|obě/);
    expect(body).toContain("<strong>18:00–19:00 Zumba fitness SPECIAL</strong>");
    expect(body).toContain("Zumba Toning v 17:00 se nakonec nekoná");
    expect(body).toContain(`<a href="/rozvrh/${FITNESS}">18:00 Zumba fitness SPECIAL</a>`);
    expect(body).toContain("členové nic neplatí – lekci mají v ceně členství!");

    const c = await texts();
    expect(c["promoBar.text"]).toBe("💃 Pondělí 16. 11. v 18:00 – Zumba SPECIAL s Márou, Marťou a Terkou!");
    expect(c["promoBar.linkUrl"]).toBe(`/nastenka#${POST}`);
    expect(c["popup.title"]).toBe("💃 Zumba SPECIAL s Márou, Marťou a Terkou – pondělí 16. 11. v 18:00");
    // one button, to the lesson that takes place – no dead links to the Toning
    expect([c["popup.buttonLabel"], c["popup.buttonUrl"]]).toEqual(["Rezervovat Zumbu 18:00", `/rozvrh/${FITNESS}`]);
    expect([c["popup.buttonLabel2"], c["popup.buttonUrl2"], c["popup.buttonLabel3"], c["popup.buttonUrl3"]]).toEqual(["", "", "", ""]);
    expect(c["popup.until"]).toBe("2026-11-16");

    // the new posters are there, in the sizes the pop-up shows
    const ids = [c["popup.image"], c["popup.imageMobile"]].map((u) => u.match(/^\/media\/(.+)\.webp$/)![1]);
    expect(ids).toEqual(["b7e0c5a2-3d41-4f6e-9a18-2c5d7f90e611", "c1f4d8b3-6a27-4e59-8b0c-3e9a1d42f722"]);
    const pics = await h.db.select({ id: media.id, width: media.width, height: media.height, size: media.size, data: media.data }).from(media).where(inArray(media.id, ids));
    expect(pics.map((p) => [p.width, p.height]).sort()).toEqual([[1080, 1350], [1600, 900]]);
    for (const p of pics) {
      expect(p.data.length).toBe(p.size);
      expect(Buffer.from(p.data).subarray(8, 12).toString()).toBe("WEBP");
    }
  });

  it("run again it changes nothing, and what the studio rewrites afterwards stays", async () => {
    await setText("promoBar.text", "💃 Dnes v 18:00 tančíme s Márou a Marťou!");
    await setText("popup.buttonLabel", "Chci tančit");
    await h.db.update(announcements).set({ body: "<p>Vlastní text studia</p>" }).where(eq(announcements.id, POST));
    await h.db.update(classSessions).set({ note: "Vlastní poznámka" }).where(eq(classSessions.id, FITNESS));
    const before = [await texts(), await post(), await note()];
    await migrate();
    expect([await texts(), await post(), await note()]).toEqual(before);
  });
});
