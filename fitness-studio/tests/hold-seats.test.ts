import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, users } from "@/db/schema";
import { bookSession, holdSeats, joinWaitlist, occupancy } from "@/domain/booking";
import { dueReminders } from "@/domain/reminders";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("staff holds spots for themselves", () => {
  it("blocks, changes and releases spots; the waitlist moves up", async () => {
    const admin = await makeUser(h.db);
    await h.db.update(users).set({ role: "admin", remindersOptIn: true }).where(eq(users.id, admin.id));
    const s = await makeSession(h.db, { capacity: 12 });

    await holdSeats(h.db, { sessionId: s.id, userId: admin.id, seats: 10, note: "firma XY" }, NOW);
    expect(await occupancy(h.db, s.id)).toBe(10);
    await expect(holdSeats(h.db, { sessionId: s.id, userId: admin.id, seats: 13 }, NOW)).rejects.toThrow(/jen 12/);

    // two clients fill the class, a third waits
    const [a, b, c] = [await makeUser(h.db, 5), await makeUser(h.db, 5), await makeUser(h.db, 5)];
    await bookSession(h.db, { userId: a.id, sessionId: s.id, method: "credits" }, NOW);
    await bookSession(h.db, { userId: b.id, sessionId: s.id, method: "credits" }, NOW);
    await joinWaitlist(h.db, { userId: c.id, sessionId: s.id }, NOW);
    await expect(holdSeats(h.db, { sessionId: s.id, userId: admin.id, seats: 11 }, NOW)).rejects.toThrow(/jen 10/);

    // fewer held spots → the waiting client gets in
    const r = await holdSeats(h.db, { sessionId: s.id, userId: admin.id, seats: 9 }, NOW);
    expect(r.promoted.map((x) => x.userId)).toEqual([c.id]);
    expect(await occupancy(h.db, s.id)).toBe(12);

    // no reminder e-mail for a hold
    const due = await dueReminders(h.db, new Date(s.startsAt.getTime() - 3_600_000));
    expect(due.classes.some((x) => x.userId === admin.id)).toBe(false);

    await holdSeats(h.db, { sessionId: s.id, userId: admin.id, seats: 0 }, NOW);
    expect(await occupancy(h.db, s.id)).toBe(3);
    const rows = await h.db.select().from(bookings).where(eq(bookings.userId, admin.id));
    expect(rows.every((x) => x.status === "cancelled")).toBe(true);
  });
});
