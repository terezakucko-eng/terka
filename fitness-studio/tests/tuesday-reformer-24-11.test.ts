import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classSessions, classTypes, instructors } from "@/db/schema";
import { seriesFrom } from "@/domain/cleanup";
import { pragueLocalToDate } from "@/lib/dates";
import { testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const ID = "295a46a8-a154-4d21-b739-f2c4beb5598c";
const SERIES = "00435959-5343-479d-a531-53f841063962";
const DUO = "d2f6a8c4-3b17-4e59-9a0d-7c1e5b8f2a46";
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

  it("leaves the slot alone when the machines are taken", async () => {
    await h.db.delete(classSessions).where(eq(classSessions.id, ID));
    const [hadDuo] = await h.db.select().from(classTypes).where(eq(classTypes.id, DUO));
    if (!hadDuo) await h.db.insert(classTypes).values({ id: DUO, name: "Reformer Duo", slug: "reformer-duo-24-11", capacity: 2, creditCost: 430, dropInPrice: 49000 });
    await h.db.insert(classSessions).values({ classTypeId: DUO, startsAt: pragueLocalToDate("2026-11-24T17:30"), durationMin: 60, capacity: 2, creditCost: 430 });
    await migrate();
    expect(await added()).toHaveLength(0);
  });
});
