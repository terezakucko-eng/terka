import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookSession } from "@/domain/booking";
import { dueReminders, markReminded } from "@/domain/reminders";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("evening reminders", () => {
  it("picks tomorrow's confirmed classes once", async () => {
    // NOW = 5.10. 10:00 Prague → tomorrow is 6.10.
    const tomorrow = await makeSession(h.db, { startsAt: hours(24) });
    const later = await makeSession(h.db, { startsAt: hours(72) });
    const u = await makeUser(h.db, 5);
    await bookSession(h.db, { userId: u.id, sessionId: tomorrow.id, method: "credits" }, NOW);
    await bookSession(h.db, { userId: u.id, sessionId: later.id, method: "credits" }, NOW);
    const due = await dueReminders(h.db, NOW);
    expect(due.classes.map((c) => c.sessionId)).toEqual([tomorrow.id]);
    await markReminded(h.db, { classes: due.classes.map((c) => c.id), massages: [] }, NOW);
    expect((await dueReminders(h.db, NOW)).classes).toHaveLength(0);
  });
});
