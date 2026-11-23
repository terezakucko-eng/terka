import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classSessions, classTypes, instructors, users } from "@/db/schema";
import { NO_CREDITS, bookSession, bookingOptions } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { saveSettings } from "@/lib/settings";
import { makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
  await saveSettings(h.db, { bookingWindowWeeks: 0, memberBookingWindowWeeks: 0, bookingWindowDays: 900, memberBookingWindowDays: 900 });
});
afterAll(async () => h.close());

const TYPE = "907efc90-899b-47a0-906f-6e4b41357c27";
const SESSION = "22e83185-2450-44e8-b181-d68be9dcbdb5";
const NOW = new Date("2026-12-01T10:00:00Z");
const migrate = async () => {
  for (const statement of readFileSync("drizzle/0175_reformer_special_29_1.sql", "utf8").split("--> statement-breakpoint")) await h.db.execute(sql.raw(statement));
};
const typeOf = async (slug: string, values: Partial<typeof classTypes.$inferInsert> = {}) => {
  const [had] = await h.db.select().from(classTypes).where(eq(classTypes.slug, slug));
  return had ?? (await h.db.insert(classTypes).values({ name: slug, slug, ...values }).returning())[0];
};

describe("migration 0175: Reformer special on 29 January 2027", () => {
  it("creates the lesson and its Friday session, and drops the overlapping empty Zdravé tělo", async () => {
    const reformer = await typeOf("reformer-fusion", { color: "#5a6b4f", imageUrl: "/media/reformer.webp", cancellationHours: 24 });
    const silovy = await typeOf("zdrave-telo-silovy-special-test", { name: "Zdravé tělo | silový trénink" });
    const [lektorka] = await h.db.insert(instructors).values({ name: "Lektorka", slug: "lektorka-special" }).returning();
    await h.db.insert(classSessions).values({ classTypeId: reformer.id, instructorId: lektorka.id, room: "Reformer", startsAt: pragueLocalToDate("2027-01-04T06:00"), durationMin: 60, capacity: 6, creditCost: 340 });
    const [zt] = await h.db.insert(classSessions).values({ classTypeId: silovy.id, startsAt: pragueLocalToDate("2027-01-29T16:00"), durationMin: 60, capacity: 12, creditCost: 250 }).returning();
    const [ztOther] = await h.db.insert(classSessions).values({ classTypeId: silovy.id, startsAt: pragueLocalToDate("2027-02-05T16:00"), durationMin: 60, capacity: 12, creditCost: 250 }).returning();

    await migrate();

    const [ct] = await h.db.select().from(classTypes).where(eq(classTypes.id, TYPE));
    expect(ct).toMatchObject({
      name: "Reformer special", slug: "reformer-special", durationMin: 180, capacity: 12, dropInPrice: 69000, memberSurcharge: 39000,
      noPass: true, noCredits: true, noFreeEntry: true, passCardEntry: false, color: "#5a6b4f", imageUrl: "/media/reformer.webp", isActive: true,
    });
    expect(ct.description).toContain("ve dvojicích");
    expect(ct.description).toContain("protiskluzové ponožky");
    const [s] = await h.db.select().from(classSessions).where(eq(classSessions.id, SESSION));
    expect(s).toMatchObject({ classTypeId: TYPE, instructorId: lektorka.id, room: "Reformer", durationMin: 180, capacity: 12, dropInPrice: 69000, status: "scheduled" });
    expect(s.startsAt).toEqual(pragueLocalToDate("2027-01-29T16:00"));
    expect(s.bookingOpensAt).toEqual(pragueLocalToDate("2026-11-23T00:00"));
    const st = async (id: string) => (await h.db.select().from(classSessions).where(eq(classSessions.id, id)))[0].status;
    expect(await st(zt.id)).toBe("cancelled");
    expect(await st(ztOther.id)).toBe("scheduled");

    // again: nothing more
    await migrate();
    expect(await h.db.select().from(classTypes).where(eq(classTypes.slug, "reformer-special"))).toHaveLength(1);
  });

  it("members pay the 390 Kč surcharge, the others 690 Kč – no credits, passes or free entries", async () => {
    const [s] = await h.db.select().from(classSessions).where(eq(classSessions.id, SESSION));
    const options = (userId: string) => h.db.transaction((tx) => bookingOptions(tx, userId, s, 1, NOW));

    const guest = await makeUser(h.db, 5000);
    const g = await options(guest.id);
    expect(g.some((o) => o.method === "credits")).toBe(false);
    expect(g.find((o) => o.method === "drop_in")!.label).toMatch(/690\sKč/);
    await expect(bookSession(h.db, { userId: guest.id, sessionId: s.id, method: "credits" }, NOW)).rejects.toThrow(NO_CREDITS);
    expect((await h.db.select().from(users).where(eq(users.id, guest.id)))[0].creditBalance).toBe(5000);

    const member = await makeUser(h.db);
    const m = await grantEntitlement(h.db, { userId: member.id, kind: "membership", name: "Členství", entries: null, validityDays: 120 }, NOW);
    expect((await options(member.id)).find((o) => o.entitlementId === m.id)!.detail).toMatch(/doplatek 390\sKč/);

    const holder = await makeUser(h.db);
    const p = await grantEntitlement(h.db, { userId: holder.id, kind: "pass", name: "Permanentka", entries: 10, validityDays: 120 }, NOW);
    expect((await options(holder.id)).find((o) => o.entitlementId === p.id)!.disabled).toBeTruthy();
  });

  it("keeps a Zdravé tělo someone already booked – the studio cancels it with a refund", async () => {
    const silovy = await typeOf("zdrave-telo-silovy-special-test");
    await h.db.update(classSessions).set({ status: "scheduled" }).where(eq(classSessions.startsAt, pragueLocalToDate("2027-01-29T16:00")));
    const [zt] = await h.db.select().from(classSessions).where(eq(classSessions.startsAt, pragueLocalToDate("2027-01-29T16:00")));
    expect(zt.classTypeId).toBe(silovy.id);
    await h.db.insert(bookings).values({ userId: (await makeUser(h.db)).id, sessionId: zt.id, status: "confirmed", method: "credits" });
    await migrate();
    expect((await h.db.select().from(classSessions).where(eq(classSessions.id, zt.id)))[0].status).toBe("scheduled");
  });
});
