import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classSessions, users } from "@/db/schema";
import { site } from "@/config/site";
import { calendarOwner, studioEvents } from "@/domain/calendar";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const host = new URL(site.url).host;

describe("the studio's schedule in the admin's calendar", () => {
  it("lists every lesson that takes place, with how many are booked, not cancelled or long-past ones", async () => {
    const s = await makeSession(h.db, { startsAt: hours(30), capacity: 6, title: "Reformer special" });
    const free = await makeSession(h.db, { startsAt: hours(54), capacity: 12 });
    const cancelled = await makeSession(h.db, { startsAt: hours(78) });
    await h.db.update(classSessions).set({ status: "cancelled" }).where(eq(classSessions.id, cancelled.id));
    const old = await makeSession(h.db, { startsAt: hours(-24 * 90) });
    const a = await makeUser(h.db), b = await makeUser(h.db), c = await makeUser(h.db);
    await h.db.insert(bookings).values([
      { userId: a.id, sessionId: s.id, status: "confirmed", method: "credits", seats: 2 },
      { userId: b.id, sessionId: s.id, status: "attended", method: "credits" },
      { userId: c.id, sessionId: s.id, status: "cancelled", method: "credits" },
    ]);

    const events = await studioEvents(h.db, "Pospolitá 699/16, Ostrava", NOW);
    const ids = events.map((e) => e.uid);
    expect(ids).toContain(`rozvrh-${s.id}@${host}`);
    expect(ids).toContain(`rozvrh-${free.id}@${host}`);
    expect(ids).not.toContain(`rozvrh-${cancelled.id}@${host}`);
    expect(ids).not.toContain(`rozvrh-${old.id}@${host}`);
    const e = events.find((x) => x.uid === `rozvrh-${s.id}@${host}`)!;
    expect(e.title).toBe("Reformer special · 3/6");
    expect(e.description).toContain("Přihlášeno: 3 z 6");
    expect(e.url).toBe(`${site.url}/admin/rozvrh/${s.id}`);
    expect(events.find((x) => x.uid === `rozvrh-${free.id}@${host}`)!.title).toMatch(/ · 0\/12$/);
  });

  it("tells the feed whose it is – an admin gets the studio's schedule", async () => {
    const admin = await makeUser(h.db);
    await h.db.update(users).set({ role: "admin" }).where(eq(users.id, admin.id));
    const [u] = await h.db.select().from(users).where(eq(users.id, admin.id));
    expect(await calendarOwner(h.db, u.calendarToken)).toEqual({ id: admin.id, role: "admin" });
  });
});
