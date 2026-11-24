import { readFileSync } from "node:fs";
import { asc, eq, inArray, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, bookings, campaigns, classSessions, classTypes } from "@/db/schema";
import { pragueLocalToDate, toLocalInput } from "@/lib/dates";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const DRAFT = "76e9fcf1-629f-43c0-9839-e5a375890bd0";
const NEWS = "a8e3c5d1-6f24-4b97-8c0e-2d71b4f9e635";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0180_wednesday_kettlebell_17_reformer_18.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const typeOf = async (slug: string) => {
  const [had] = await h.db.select().from(classTypes).where(eq(classTypes.slug, slug));
  return had ?? (await h.db.insert(classTypes).values({ name: slug, slug }).returning())[0];
};

describe("migration 0180: Wednesday Kettlebell at 17:00, Reformer at 18:00 from 2 Dec 2026", () => {
  it("swaps the Wednesday times from next week, drafts a note for who's booked and updates the notice", async () => {
    const reformer = await typeOf("reformer-fusion");
    const kettlebell = await typeOf("kettlebell");
    const session = (typeId: string, local: string) =>
      h.db.insert(classSessions).values({ classTypeId: typeId, startsAt: pragueLocalToDate(local), durationMin: 60, capacity: 6, creditCost: 340 }).returning().then((r) => r[0]);
    const thisWeekR = await session(reformer.id, "2026-11-25T17:00");
    const thisWeekK = await session(kettlebell.id, "2026-11-25T18:00");
    const r1 = await session(reformer.id, "2026-12-02T17:00");
    const k1 = await session(kettlebell.id, "2026-12-02T18:00");
    const r2 = await session(reformer.id, "2027-06-09T17:00"); // summer time too
    const k2 = await session(kettlebell.id, "2027-06-09T18:00");
    const friR = await session(reformer.id, "2026-12-04T17:00"); // not a Wednesday – stays
    const booked = await makeUser(h.db);
    await h.db.insert(bookings).values({ userId: booked.id, sessionId: r1.id, status: "confirmed", method: "credits" });
    const BODY = "<li>Termíny: pondělí 6:00, úterý 18:00, středa 17:00, pátek 6:30 a neděle 17:00.</li>";
    await h.db.insert(announcements).values({ id: NEWS, title: "Reformer", body: BODY }).onConflictDoNothing();
    await h.db.update(announcements).set({ body: BODY }).where(eq(announcements.id, NEWS));

    await migrate();

    const at = async (id: string) => toLocalInput((await h.db.select().from(classSessions).where(eq(classSessions.id, id)))[0].startsAt);
    expect(await at(thisWeekR.id)).toBe("2026-11-25T17:00");
    expect(await at(thisWeekK.id)).toBe("2026-11-25T18:00");
    expect(await at(r1.id)).toBe("2026-12-02T18:00");
    expect(await at(k1.id)).toBe("2026-12-02T17:00");
    expect(await at(r2.id)).toBe("2027-06-09T18:00");
    expect(await at(k2.id)).toBe("2027-06-09T17:00");
    expect(await at(friR.id)).toBe("2026-12-04T17:00");

    const [draft] = await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT));
    expect(draft).toMatchObject({ status: "draft", purpose: "service", audience: { segment: "people", userIds: [booked.id] } });
    expect(draft.body).toContain("17:00–18:00 Kettlebell");
    expect((await h.db.select().from(announcements).where(eq(announcements.id, NEWS)))[0].body).toContain("středa 18:00");

    // again: nothing more
    await migrate();
    expect(await at(r1.id)).toBe("2026-12-02T18:00");
    expect(await at(k1.id)).toBe("2026-12-02T17:00");
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT))).toHaveLength(1);
    const all = await h.db.select().from(classSessions).where(inArray(classSessions.classTypeId, [reformer.id, kettlebell.id])).orderBy(asc(classSessions.startsAt));
    expect(all).toHaveLength(7);
  });

  it("leaves a Wednesday alone where the new time is already taken by the same lesson", async () => {
    const reformer = await typeOf("reformer-fusion");
    const [r] = await h.db.insert(classSessions).values({ classTypeId: reformer.id, startsAt: pragueLocalToDate("2026-12-16T17:00"), durationMin: 60, capacity: 6, creditCost: 340 }).returning();
    await h.db.insert(classSessions).values({ classTypeId: reformer.id, startsAt: pragueLocalToDate("2026-12-16T18:00"), durationMin: 60, capacity: 6, creditCost: 340 });
    await migrate();
    expect(toLocalInput((await h.db.select().from(classSessions).where(eq(classSessions.id, r.id)))[0].startsAt)).toBe("2026-12-16T17:00");
  });
});
