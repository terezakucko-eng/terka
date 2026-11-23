import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, campaigns, classSessions, classTypes, instructors } from "@/db/schema";
import { bookingOptions } from "@/domain/booking";
import { seriesFrom } from "@/domain/cleanup";
import { pragueLocalToDate } from "@/lib/dates";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const ID = "295a46a8-a154-4d21-b739-f2c4beb5598c";
const SERIES = "00435959-5343-479d-a531-53f841063962";
const DUO = "d2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46";
const DRAFT16 = "fd8992e4-2861-4081-a4d3-cdb7ba240a83";
const DRAFT18 = "a045476b-5764-4598-a117-e11d3aed18dc";
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0176_tuesday_reformer_24_11.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const added = () => h.db.select().from(classSessions).where(eq(classSessions.id, ID));

describe("migration 0176: group Reformer on Tuesday 24 Nov 2026 at 18:00", () => {
  it("does nothing without the Tuesday series", async () => {
    await migrate();
    expect(await added()).toHaveLength(0);
  });

  it("adds it to the Tuesday series with the November price, once", async () => {
    const values = { capacity: 6, durationMin: 60, creditCost: 400, dropInPrice: 49000, creditCostNext: 340, dropInPriceNext: 39000, memberSurchargeNextFrom: "2026-12-01" };
    const [had] = await h.db.select().from(classTypes).where(eq(classTypes.slug, "reformer-fusion"));
    const reformer = had
      ? (await h.db.update(classTypes).set(values).where(eq(classTypes.id, had.id)).returning())[0]
      : (await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-fusion", ...values }).returning())[0];
    const [lektorka] = await h.db.insert(instructors).values({ name: "Lektorka", slug: "lektorka-24-11" }).returning();
    const [dec1] = await h.db.insert(classSessions).values({ classTypeId: reformer.id, instructorId: lektorka.id, room: "Reformer", startsAt: pragueLocalToDate("2026-12-01T18:00"), durationMin: 60, capacity: 6, creditCost: 340, dropInPrice: 39000, seriesId: SERIES }).returning();

    await migrate();

    const [s] = await added();
    expect(s).toMatchObject({ classTypeId: reformer.id, instructorId: lektorka.id, room: "Reformer", durationMin: 60, capacity: 6, creditCost: 400, dropInPrice: 49000, seriesId: SERIES, status: "scheduled" });
    expect(s.startsAt).toEqual(pragueLocalToDate("2026-11-24T18:00"));
    expect((await seriesFrom(h.db, s.id)).map((x) => x.id)).toEqual(expect.arrayContaining([s.id, dec1.id]));

    await migrate();
    expect(await h.db.select().from(classSessions).where(eq(classSessions.startsAt, pragueLocalToDate("2026-11-24T18:00")))).toHaveLength(1);
  });

  it("makes it free for everyone (0177) – not once someone has booked it", async () => {
    const free = async () => {
      for (const statement of readFileSync("drizzle/0177_tuesday_reformer_24_11_free.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
    };
    const user = await makeUser(h.db);
    const [b] = await h.db.insert(bookings).values({ userId: user.id, sessionId: ID, status: "confirmed", method: "credits" }).returning();
    await free();
    expect((await added())[0]).toMatchObject({ isFree: false, note: null });

    await h.db.update(bookings).set({ status: "cancelled" }).where(eq(bookings.id, b.id));
    await free();
    const [s] = await added();
    expect(s.isFree).toBe(true);
    expect(s.note).toContain("Ochutnávka zdarma pro všechny");
    const options = await h.db.transaction((tx) => bookingOptions(tx, user.id, s, 1, new Date("2026-11-23T10:00:00Z")));
    expect(options.map((o) => o.method)).toEqual(["free_class"]);

    await free();
    expect((await added())[0].note).toBe(s.note);
  });

  it("moves it to 16:00 and out of the series (0178), drafting a note for who's booked", async () => {
    const at16 = async () => {
      for (const statement of readFileSync("drizzle/0178_tuesday_reformer_24_11_at_16.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
    };
    const user = await makeUser(h.db);
    await h.db.insert(bookings).values({ userId: user.id, sessionId: ID, status: "confirmed", method: "free_class" });
    await at16();
    const [s] = await added();
    expect(s.startsAt).toEqual(pragueLocalToDate("2026-11-24T16:00"));
    expect(s.seriesId).toBeNull();
    expect(s.isFree).toBe(true);
    const [draft] = await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT16));
    expect(draft).toMatchObject({ status: "draft", purpose: "service", subject: "Reformer zdarma v úterý nově v 16:00", audience: { segment: "people", userIds: [user.id] } });

    await at16();
    expect((await added())[0].startsAt).toEqual(pragueLocalToDate("2026-11-24T16:00"));
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT16))).toHaveLength(1);
  });

  it("goes back to 18:00 and into the series (0179), dropping the unsent 16:00 note", async () => {
    const at18 = async () => {
      for (const statement of readFileSync("drizzle/0179_tuesday_reformer_24_11_back_at_18.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
    };
    expect((await added())[0].startsAt).toEqual(pragueLocalToDate("2026-11-24T16:00"));
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT16))).toHaveLength(1);
    const booked = (await h.db.select().from(bookings).where(eq(bookings.sessionId, ID))).filter((b) => b.status !== "cancelled").map((b) => b.userId);

    await at18();

    const [s] = await added();
    expect(s).toMatchObject({ startsAt: pragueLocalToDate("2026-11-24T18:00"), seriesId: SERIES, isFree: true, status: "scheduled" });
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT16))).toHaveLength(0);
    const [draft] = await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT18));
    expect(draft).toMatchObject({ status: "draft", purpose: "service", subject: "Reformer zdarma je zítra v 18:00", audience: { segment: "people", userIds: booked } });

    await at18();
    expect((await added())[0].startsAt).toEqual(pragueLocalToDate("2026-11-24T18:00"));
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT18))).toHaveLength(1);
    await h.db.delete(campaigns).where(eq(campaigns.id, DRAFT18));
  });

  it("stays at 18:00 when the machines are taken at 16:00", async () => {
    const at16 = async () => {
      for (const statement of readFileSync("drizzle/0178_tuesday_reformer_24_11_at_16.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
    };
    await h.db.delete(campaigns).where(eq(campaigns.id, DRAFT16));
    await h.db.update(classSessions).set({ startsAt: pragueLocalToDate("2026-11-24T18:00"), seriesId: SERIES }).where(eq(classSessions.id, ID));
    const [reformer] = await h.db.select().from(classTypes).where(eq(classTypes.slug, "reformer-fusion"));
    const [busy] = await h.db.insert(classSessions).values({ classTypeId: reformer.id, startsAt: pragueLocalToDate("2026-11-24T15:30"), durationMin: 60, capacity: 6, creditCost: 400 }).returning();
    await at16();
    expect((await added())[0]).toMatchObject({ startsAt: pragueLocalToDate("2026-11-24T18:00"), seriesId: SERIES });
    expect(await h.db.select().from(campaigns).where(eq(campaigns.id, DRAFT16))).toHaveLength(0);
    await h.db.delete(classSessions).where(eq(classSessions.id, busy.id));
  });

  it("leaves the slot alone when the machines are taken", async () => {
    await h.db.delete(bookings).where(eq(bookings.sessionId, ID));
    await h.db.delete(classSessions).where(eq(classSessions.id, ID));
    const [hadDuo] = await h.db.select().from(classTypes).where(eq(classTypes.id, DUO));
    if (!hadDuo) await h.db.insert(classTypes).values({ id: DUO, name: "Reformer Duo", slug: "reformer-duo-24-11", capacity: 2, creditCost: 430, dropInPrice: 49000 });
    await h.db.insert(classSessions).values({ classTypeId: DUO, startsAt: pragueLocalToDate("2026-11-24T17:30"), durationMin: 60, capacity: 2, creditCost: 430 });
    await migrate();
    expect(await added()).toHaveLength(0);
  });
});
