import { readFileSync } from "node:fs";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, campaigns, classSessions, classTypes, instructors } from "@/db/schema";
import { seriesFrom } from "@/domain/cleanup";
import { addDays, dateKey, pragueLocalToDate, toLocalInput, weekdayOf } from "@/lib/dates";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const REF = "43677e69-20fb-49ad-8df2-125a1df6cada";
const DRAFT = "6a378e00-6fc8-417e-9cc0-ba359566afc0";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0166_tuesday_toning_back.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};

/** Tuesdays 17:00 and Saturdays 8:30 from 24 Nov 2026 to 2 Jan 2027, one series – as the admin made it before the fix */
async function setup(tag: string) {
  const [toning] = await h.db.insert(classTypes).values({ name: "Zumba Toning", slug: `zumba-toning-${tag}`, durationMin: 45, creditCost: 220, dropInPrice: 25000 }).returning();
  const [barre] = await h.db.insert(classTypes).values({ name: "Barre", slug: `barre-${tag}`, durationMin: 60, creditCost: 220, dropInPrice: 25000 }).returning();
  const [ivana] = await h.db.insert(instructors).values({ name: "Ivana", slug: `ivana-${tag}` }).returning();
  const [jana] = await h.db.insert(instructors).values({ name: "Jana", slug: `jana-${tag}` }).returning();
  const series = crypto.randomUUID();
  const rows: (typeof classSessions.$inferInsert)[] = [];
  for (let d = "2026-11-24"; d <= "2027-01-02"; d = addDays(d, 1)) {
    const wd = weekdayOf(d);
    if (wd !== 1 && wd !== 5) continue;
    rows.push({
      id: d === "2026-11-24" && tag === "b" ? REF : undefined,
      classTypeId: toning.id, instructorId: wd === 1 ? ivana.id : jana.id, startsAt: pragueLocalToDate(`${d}T${wd === 1 ? "17:00" : "08:30"}`),
      durationMin: 45, capacity: 12, creditCost: 220, dropInPrice: 25000, room: wd === 1 ? "Velký sál" : "Malý sál", seriesId: series,
    });
  }
  await h.db.insert(classSessions).values(rows);
  return { toning, barre, ivana, jana, series };
}

describe("a series made for several weekdays", () => {
  it("changes only the edited weekday with “this and the following”", async () => {
    const { series } = await setup("a");
    const [sat] = await h.db.select().from(classSessions).where(and(eq(classSessions.seriesId, series), eq(classSessions.startsAt, pragueLocalToDate("2026-11-28T08:30"))));
    const list = await seriesFrom(h.db, sat.id);
    expect(list.length).toBe(6);
    expect(new Set(list.map((s) => weekdayOf(dateKey(s.startsAt))))).toEqual(new Set([5]));
    expect(list.every((s) => s.seriesId === series)).toBe(true);
    await h.db.delete(classSessions).where(eq(classSessions.seriesId, series));
  });
});

describe("migration 0166: Tuesday Zumba Toning back", () => {
  it("restores the Tuesdays changed with the Saturdays, leaves the Saturdays as Barre and drafts an apology for who's booked", async () => {
    const { toning, barre, ivana, jana, series } = await setup("b");
    // what happened on the web: Sat 28 Nov "this and the following" → Barre 8:30, 60 min, Jana (Tuesdays too)…
    const later = await h.db.select().from(classSessions).where(and(eq(classSessions.seriesId, series), sql`${classSessions.startsAt} >= ${pragueLocalToDate("2026-11-28T00:00")}`));
    for (const s of later)
      await h.db.update(classSessions).set({ classTypeId: barre.id, instructorId: jana.id, durationMin: 60, room: "Malý sál", startsAt: pragueLocalToDate(`${dateKey(s.startsAt)}T08:30`) }).where(eq(classSessions.id, s.id));
    // …then Tue 1 Dec back to Zumba Toning, but still at 8:30
    const at = (local: string) => h.db.select().from(classSessions).where(and(eq(classSessions.seriesId, series), eq(classSessions.startsAt, pragueLocalToDate(local)))).then((r) => r[0]);
    await h.db.update(classSessions).set({ classTypeId: toning.id, durationMin: 45 }).where(eq(classSessions.id, (await at("2026-12-01T08:30")).id));
    // someone booked a moved Tuesday, someone a Saturday
    const tueClient = await makeUser(h.db);
    const satClient = await makeUser(h.db);
    await h.db.insert(bookings).values({ userId: tueClient.id, sessionId: (await at("2026-12-08T08:30")).id, status: "confirmed", method: "credits" });
    await h.db.insert(bookings).values({ userId: satClient.id, sessionId: (await at("2026-12-05T08:30")).id, status: "confirmed", method: "credits" });
    // the studio already put a Zumba Toning on Tue 15 Dec 17:00 by hand – that Tuesday stays as it is
    await h.db.insert(classSessions).values({ classTypeId: toning.id, instructorId: ivana.id, startsAt: pragueLocalToDate("2026-12-15T17:00"), durationMin: 45, capacity: 12, creditCost: 220 });

    await migrate();

    const mine = () => h.db.select().from(classSessions).where(inArray(classSessions.classTypeId, [toning.id, barre.id])).orderBy(asc(classSessions.startsAt));
    const all = await mine();
    const view = all.map((s) => `${toLocalInput(s.startsAt)} ${s.classTypeId === toning.id ? "toning" : "barre"} ${s.durationMin} ${s.instructorId === ivana.id ? "ivana" : "jana"} ${s.room ?? "-"}`);
    expect(view).toEqual([
      "2026-11-24T17:00 toning 45 ivana Velký sál",
      "2026-11-28T08:30 barre 60 jana Malý sál",
      "2026-12-01T17:00 toning 45 ivana Velký sál",
      "2026-12-05T08:30 barre 60 jana Malý sál",
      "2026-12-08T17:00 toning 45 ivana Velký sál",
      "2026-12-12T08:30 barre 60 jana Malý sál",
      "2026-12-15T08:30 barre 60 jana Malý sál",
      "2026-12-15T17:00 toning 45 ivana -",
      "2026-12-19T08:30 barre 60 jana Malý sál",
      "2026-12-22T17:00 toning 45 ivana Velký sál",
      "2026-12-26T08:30 barre 60 jana Malý sál",
      "2026-12-29T17:00 toning 45 ivana Velký sál",
      "2027-01-02T08:30 barre 60 jana Malý sál",
    ]);

    // an apology for the one booked on a moved Tuesday – a draft only, not for the Saturday client
    const [draft] = await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT));
    expect(draft).toMatchObject({ status: "draft", purpose: "service", channel: "email", subject: "Úterní Zumba Toning zůstává v 17:00", audience: { segment: "people", userIds: [tueClient.id] } });
    expect(draft.body).toContain("zůstává jako vždycky v 17:00–17:45");

    // again: nothing changes
    await migrate();
    expect((await mine()).map((s) => +s.startsAt)).toEqual(all.map((s) => +s.startsAt));
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT))).toHaveLength(1);
  });

  it("drafts nothing when nobody is booked on a moved Tuesday", async () => {
    await h.db.delete(campaigns).where(eq(campaigns.id, DRAFT));
    await migrate();
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT))).toHaveLength(0);
  });
});
