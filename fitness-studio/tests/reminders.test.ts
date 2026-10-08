import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, users } from "@/db/schema";
import { bookSession } from "@/domain/booking";
import { dueReminders, markReminded } from "@/domain/reminders";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const optIn = (id: string) => h.db.update(users).set({ remindersOptIn: true }).where(eq(users.id, id));

describe("reminders 3 hours before", () => {
  it("picks classes starting within 3 hours, once", async () => {
    const soon = await makeSession(h.db, { startsAt: hours(50) });
    const later = await makeSession(h.db, { startsAt: hours(56) });
    const u = await makeUser(h.db, 5);
    await optIn(u.id);
    await bookSession(h.db, { userId: u.id, sessionId: soon.id, method: "credits" }, NOW);
    await bookSession(h.db, { userId: u.id, sessionId: later.id, method: "credits" }, NOW);
    // booked at the test's NOW, not the real clock (which is past these classes after 7 Oct 2026)
    await h.db.update(bookings).set({ createdAt: NOW }).where(eq(bookings.userId, u.id));
    const at = hours(48); // 2 h before `soon`, 8 h before `later`
    const due = await dueReminders(h.db, at);
    expect(due.classes.map((c) => c.sessionId)).toEqual([soon.id]);
    await markReminded(h.db, { classes: due.classes.map((c) => c.id), massages: [] }, at);
    expect((await dueReminders(h.db, at)).classes).toHaveLength(0);
  });

  it("skips clients who didn't ask for reminders", async () => {
    const s = await makeSession(h.db, { startsAt: hours(30) });
    const u = await makeUser(h.db, 5);
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW);
    expect((await dueReminders(h.db, hours(28))).classes.map((c) => c.sessionId)).not.toContain(s.id);
  });

  it("skips bookings made less than 3 hours before the start", async () => {
    const s = await makeSession(h.db, { startsAt: hours(40) });
    const u = await makeUser(h.db, 5);
    await optIn(u.id);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW);
    await h.db.update(bookings).set({ createdAt: hours(39) }).where(eq(bookings.id, booking.id));
    expect((await dueReminders(h.db, hours(39))).classes.map((c) => c.sessionId)).not.toContain(s.id);
  });
});
