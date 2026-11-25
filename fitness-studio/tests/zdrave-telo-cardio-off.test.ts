import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classSessions, classTypes } from "@/db/schema";
import { adminAddBooking } from "@/domain/booking";
import { saveSettings } from "@/lib/settings";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
  await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 120, memberBookingWindowDays: 120 });
});
afterAll(async () => h.close());

const migrate = async () => {
  for (const statement of readFileSync("drizzle/0184_zdrave_telo_cardio_off.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const days = (d: number) => new Date(Date.now() + d * 86_400_000);

describe("migration 0184: Zdravé tělo | cardio trénink comes off the web", () => {
  it("hides the lesson and cancels its empty future classes – booked ones and Zdravé tělo | silový trénink stay", async () => {
    const [cardio] = await h.db.insert(classTypes).values({ name: "Zdravé tělo | cardio trénink", slug: "zdrave-telo-cardio-trenink" }).returning();
    const [silovy] = await h.db.insert(classTypes).values({ name: "Zdravé tělo | silový trénink", slug: "zdrave-telo-silovy-trenink" }).returning();
    const session = (classTypeId: string, startsAt: Date, title?: string) =>
      h.db.insert(classSessions).values({ classTypeId, startsAt, title, durationMin: 60, capacity: 10, creditCost: 1, dropInPrice: 25000 }).returning().then((r) => r[0]);
    const empty = await session(cardio.id, days(3));
    const booked = await session(cardio.id, days(10));
    const past = await session(cardio.id, days(-3));
    const event = await session(cardio.id, days(20), "Cardio párty");
    const strength = await session(silovy.id, days(3));
    await adminAddBooking(h.db, { sessionId: booked.id, userId: (await makeUser(h.db)).id, pay: "admin" }, new Date());

    await migrate();
    await migrate();

    const status = async (id: string) => (await h.db.select({ s: classSessions.status }).from(classSessions).where(eq(classSessions.id, id)))[0].s;
    expect(await status(empty.id)).toBe("cancelled");
    expect(await status(booked.id)).toBe("scheduled");
    expect(await status(past.id)).toBe("scheduled");
    expect(await status(event.id)).toBe("scheduled");
    expect(await status(strength.id)).toBe("scheduled");
    const active = async (id: string) => (await h.db.select({ a: classTypes.isActive }).from(classTypes).where(eq(classTypes.id, id)))[0].a;
    expect(await active(cardio.id)).toBe(false);
    expect(await active(silovy.id)).toBe(true);
  });
});
