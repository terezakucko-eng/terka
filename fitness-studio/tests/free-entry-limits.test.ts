import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, entitlements, users } from "@/db/schema";
import { bookSession, bookingOptions } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const now = pragueLocalToDate("2026-10-15T07:00");
const at = (local: string) => pragueLocalToDate(local);

describe("free entries with limits", () => {
  it("morning only: lessons starting before 12:00, booked any time ahead", async () => {
    const morning = await makeSession(h.db, { startsAt: at("2026-10-20T09:00") });
    const evening = await makeSession(h.db, { startsAt: at("2026-10-20T17:00"), classTypeId: morning.classTypeId });
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Zdarma ráno", entries: null, validityDays: 365, classTypeId: morning.classTypeId, beforeHour: 12 }, now);

    const am = (await bookingOptions(h.db, u.id, morning, 1, now)).find((o) => o.label === "Zdarma ráno");
    expect(am?.disabled).toBeUndefined();
    const pm = (await bookingOptions(h.db, u.id, evening, 1, now)).find((o) => o.label === "Zdarma ráno");
    expect(pm?.disabled).toMatch(/do 12:00/);

    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: morning.id, method: "free", entitlementId: am!.entitlementId }, now);
    expect(booking.status).toBe("confirmed");
    await expect(
      bookSession(h.db, { userId: u.id, sessionId: evening.id, method: "free", entitlementId: am!.entitlementId }, now),
    ).rejects.toThrow(/do 12:00/);
  });

  it("same day only: a spot left over on the day of the class", async () => {
    const today = await makeSession(h.db, { startsAt: at("2026-10-15T18:00") });
    const later = await makeSession(h.db, { startsAt: at("2026-10-16T18:00"), classTypeId: today.classTypeId });
    const u = await makeUser(h.db);
    const e = await grantEntitlement(h.db, { userId: u.id, kind: "free", name: "Volné místo", entries: null, validityDays: 365, sameDayOnly: true }, now);

    await expect(bookSession(h.db, { userId: u.id, sessionId: later.id, method: "free", entitlementId: e.id }, now)).rejects.toThrow(/v den lekce/);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: today.id, method: "free", entitlementId: e.id }, now);
    expect(booking.status).toBe("confirmed");
  });

  it("migration 0082 grants both to exactly one matching client", async () => {
    const [ct] = await h.db.insert(classTypes).values({ name: "Reformer fusion", slug: "reformer-fusion-mig" }).returning();
    const [r] = await h.db.insert(users).values({ email: "rk@test.cz", name: "Romana Kucková", passwordHash: "x" }).returning();
    const grants = readFileSync("drizzle/0082_entitlement_limits.sql", "utf8").split("--> statement-breakpoint").slice(2).join("");
    await h.db.execute(sql.raw(grants));
    await h.db.execute(sql.raw(grants)); // once only
    const mine = await h.db.select().from(entitlements).where(eq(entitlements.userId, r.id));
    expect(mine.map((e) => [e.name, e.classTypeId === ct.id || e.classTypeId !== null, e.beforeHour, e.sameDayOnly, e.entriesTotal]).sort()).toEqual([
      ["Reformer zdarma – ranní lekce", true, 12, false, null],
      ["Reformer zdarma – volné místo v den lekce", true, null, true, null],
    ]);
  });

  it("migration 0083 makes her general free entries unlimited, nothing else", async () => {
    const [r] = await h.db.select().from(users).where(eq(users.email, "rk@test.cz"));
    const year = await grantEntitlement(h.db, { userId: r.id, kind: "free", name: "Vstup zdarma", entries: 365, validityDays: 365 }, now);
    const welcome = await grantEntitlement(h.db, { userId: r.id, kind: "free", name: "Úvodní lekce zdarma", entries: 1, validityDays: 365 }, now);
    const other = await makeUser(h.db);
    const theirs = await grantEntitlement(h.db, { userId: other.id, kind: "free", name: "Vstup zdarma", entries: 365, validityDays: 365 }, now);

    const update = readFileSync("drizzle/0083_family_free_unlimited.sql", "utf8");
    await h.db.execute(sql.raw(update));
    await h.db.execute(sql.raw(update)); // safe to repeat

    const byId = async (id: string) => (await h.db.select().from(entitlements).where(eq(entitlements.id, id)))[0];
    const y = await byId(year.id);
    expect(y.entriesTotal).toBeNull();
    expect(y.validUntil.toISOString()).toBe("2030-12-31T22:59:00.000Z");
    expect((await byId(welcome.id)).entriesTotal).toBe(1);
    expect((await byId(theirs.id)).entriesTotal).toBe(365);
    const reformer = await h.db.select().from(entitlements).where(sql`${entitlements.userId} = ${r.id} and ${entitlements.classTypeId} is not null`);
    expect(reformer.every((e) => e.entriesTotal === null && e.validUntil.toISOString() === "2030-12-31T22:59:00.000Z")).toBe(true);
  });
});
