import { readFileSync } from "node:fs";
import { and, eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classSessions, classTypes, instructors } from "@/db/schema";
import { pragueLocalToDate } from "@/lib/dates";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const DEC = "2177a6d2-da80-4666-8b55-4be59c4d0bcf";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0173_brunch_23_1.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const typeOf = async (slug: string, values: Partial<typeof classTypes.$inferInsert> = {}) => {
  const [had] = await h.db.select().from(classTypes).where(eq(classTypes.slug, slug));
  return had ?? (await h.db.insert(classTypes).values({ name: slug, slug, ...values }).returning())[0];
};

describe("migration 0173: Barre + Brunch on 23 January 2027", () => {
  it("copies the December brunch to 23 Jan 8:30, opens booking and drops that day's empty Saturday Barre", async () => {
    const brunch = await typeOf("fitness-brunch", { capacity: 8, creditCost: 350, dropInPrice: 39000 });
    const barre = await typeOf("barre");
    const [lektorka] = await h.db.insert(instructors).values({ name: "Lektorka", slug: "lektorka-brunch" }).returning();
    await h.db.insert(classSessions).values({ id: DEC, classTypeId: brunch.id, instructorId: lektorka.id, startsAt: pragueLocalToDate("2026-12-12T08:30"), durationMin: 150, capacity: 8, creditCost: 350, dropInPrice: 39000, room: "Sál", title: "Barre + Brunch", bookingOpensAt: pragueLocalToDate("2026-10-31T00:00") });
    const [satBarre] = await h.db.insert(classSessions).values({ classTypeId: barre.id, startsAt: pragueLocalToDate("2027-01-23T08:30"), durationMin: 60, capacity: 12, creditCost: 220 }).returning();
    const [otherBarre] = await h.db.insert(classSessions).values({ classTypeId: barre.id, startsAt: pragueLocalToDate("2027-01-30T08:30"), durationMin: 60, capacity: 12, creditCost: 220 }).returning();

    await migrate();
    const jan = await h.db.select().from(classSessions).where(and(eq(classSessions.classTypeId, brunch.id), eq(classSessions.startsAt, pragueLocalToDate("2027-01-23T08:30"))));
    expect(jan).toHaveLength(1);
    expect(jan[0]).toMatchObject({ instructorId: lektorka.id, durationMin: 150, capacity: 8, creditCost: 350, dropInPrice: 39000, room: "Sál", title: "Barre + Brunch", status: "scheduled" });
    expect(jan[0].bookingOpensAt).toEqual(pragueLocalToDate("2026-11-23T00:00"));
    const st = async (id: string) => (await h.db.select().from(classSessions).where(eq(classSessions.id, id)))[0].status;
    expect(await st(satBarre.id)).toBe("cancelled");
    expect(await st(otherBarre.id)).toBe("scheduled");

    // again: no second brunch
    await migrate();
    expect(await h.db.select().from(classSessions).where(and(eq(classSessions.classTypeId, brunch.id), eq(classSessions.startsAt, pragueLocalToDate("2027-01-23T08:30"))))).toHaveLength(1);
  });

  it("leaves a Saturday Barre someone already booked – the studio cancels it with a refund", async () => {
    const barre = await typeOf("barre");
    await h.db.delete(classSessions).where(and(eq(classSessions.classTypeId, barre.id), eq(classSessions.startsAt, pragueLocalToDate("2027-01-23T08:30"))));
    const [booked] = await h.db.insert(classSessions).values({ classTypeId: barre.id, startsAt: pragueLocalToDate("2027-01-23T08:30"), durationMin: 60, capacity: 12, creditCost: 220 }).returning();
    await h.db.insert(bookings).values({ userId: (await makeUser(h.db)).id, sessionId: booked.id, status: "confirmed", method: "credits" });
    await migrate();
    expect((await h.db.select().from(classSessions).where(eq(classSessions.id, booked.id)))[0].status).toBe("scheduled");
  });
});
