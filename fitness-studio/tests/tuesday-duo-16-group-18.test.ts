import { readFileSync } from "node:fs";
import { and, asc, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, bookings, campaigns, classSessions, classTypes, instructors } from "@/db/schema";
import { dateKey, pragueLocalToDate, toLocalInput } from "@/lib/dates";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const DUO = "d2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46";
const NEWS = "a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635";
const DRAFT = "7ec83099-9eb3-46e3-86f2-b384ac170892";
const SERIES = "00435959-5343-479d-a531-53f841063962";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0172_tuesday_duo_16_group_18.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const BODY = `<li>Termíny: pondělí 6:00, středa 17:00, pátek 6:30 a neděle 17:00.</li>
<li>Termíny: úterý 18:00 a sobota 7:30.</li>`;

describe("migration 0172: Tuesday Duo at 16:00, group Reformer at 18:00", () => {
  it("moves the Tuesday Duo, adds the group Reformer where the machines are free, drafts a note for who's booked", async () => {
    const values = { capacity: 6, durationMin: 60, creditCost: 400, dropInPrice: 49000, creditCostNext: 340, dropInPriceNext: 39000, memberSurchargeNextFrom: "2026-12-01" };
    const [had] = await h.db.select().from(classTypes).where(eq(classTypes.slug, "reformer-fusion"));
    const reformer = had
      ? (await h.db.update(classTypes).set(values).where(eq(classTypes.id, had.id)).returning())[0]
      : (await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-fusion", ...values }).returning())[0];
    const [hadDuo] = await h.db.select().from(classTypes).where(eq(classTypes.id, DUO));
    if (!hadDuo) await h.db.insert(classTypes).values({ id: DUO, name: "Reformer Duo", slug: "reformer-duo-tue", capacity: 2, creditCost: 430, dropInPrice: 49000 });
    const [lektorka] = await h.db.insert(instructors).values({ name: "Lektorka", slug: "lektorka-tue" }).returning();
    const session = (typeId: string, local: string, capacity: number) =>
      h.db.insert(classSessions).values({ classTypeId: typeId, instructorId: lektorka.id, room: "Reformer", startsAt: pragueLocalToDate(local), durationMin: 60, capacity, creditCost: 430, dropInPrice: 49000 }).returning().then((r) => r[0]);
    await session(reformer.id, "2026-12-02T17:00", 6); // the Reformer the new ones copy their instructor and room from
    const tue1 = await session(DUO, "2027-11-02T18:00", 2);
    const tue2 = await session(DUO, "2027-11-09T18:00", 2);
    const sat = await session(DUO, "2027-11-06T07:30", 2);
    const blocked = await session(DUO, "2027-11-16T18:00", 2);
    await session(DUO, "2027-11-16T16:00", 2); // that Tuesday already has a Duo at 16:00 – the 18:00 one stays
    const booked = await makeUser(h.db);
    const satClient = await makeUser(h.db);
    await h.db.insert(bookings).values({ userId: booked.id, sessionId: tue1.id, status: "confirmed", method: "credits" });
    await h.db.insert(bookings).values({ userId: satClient.id, sessionId: sat.id, status: "confirmed", method: "credits" });
    await h.db.insert(announcements).values({ id: NEWS, title: "Reformer", body: BODY }).onConflictDoNothing();
    await h.db.update(announcements).set({ body: BODY }).where(eq(announcements.id, NEWS));

    await migrate();

    const at = async (id: string) => toLocalInput((await h.db.select().from(classSessions).where(eq(classSessions.id, id)))[0].startsAt);
    expect(await at(tue1.id)).toBe("2027-11-02T16:00");
    expect(await at(tue2.id)).toBe("2027-11-09T16:00");
    expect(await at(sat.id)).toBe("2027-11-06T07:30");
    expect(await at(blocked.id)).toBe("2027-11-16T18:00");

    // the group Reformer: every Tuesday 18:00 from 1 Dec 2026 to the end of 2027 – not where a Duo still is at 18:00
    const group = await h.db.select().from(classSessions).where(eq(classSessions.seriesId, SERIES)).orderBy(asc(classSessions.startsAt));
    expect(group).toHaveLength(57 - 1);
    expect(toLocalInput(group[0].startsAt)).toBe("2026-12-01T18:00");
    expect(group.map((s) => dateKey(s.startsAt))).not.toContain("2027-11-16");
    for (const s of group) expect(s).toMatchObject({ classTypeId: reformer.id, capacity: 6, creditCost: 340, dropInPrice: 39000, durationMin: 60, instructorId: lektorka.id, room: "Reformer", status: "scheduled" });
    expect(group.find((s) => dateKey(s.startsAt) === "2027-06-08")!.startsAt).toEqual(pragueLocalToDate("2027-06-08T18:00")); // summer time too

    // a note for the one booked on a moved Tuesday Duo – a draft only
    const [draft] = await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT));
    expect(draft).toMatchObject({ status: "draft", purpose: "service", subject: "Reformer Duo v úterý nově v 16:00", audience: { segment: "people", userIds: [booked.id] } });
    const post = (await h.db.select().from(announcements).where(eq(announcements.id, NEWS)))[0].body;
    expect(post).toContain("Termíny: pondělí 6:00, úterý 18:00, středa 17:00, pátek 6:30 a neděle 17:00.");
    expect(post).toContain("Termíny: úterý 16:00 a sobota 7:30.");

    // again: nothing more
    await migrate();
    expect(await h.db.select().from(classSessions).where(eq(classSessions.seriesId, SERIES))).toHaveLength(56);
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT))).toHaveLength(1);
    expect(await at(blocked.id)).toBe("2027-11-16T18:00");
    expect(await h.db.select().from(classSessions).where(and(eq(classSessions.classTypeId, DUO), eq(classSessions.startsAt, pragueLocalToDate("2027-11-02T16:00"))))).toHaveLength(1);
  });
});
