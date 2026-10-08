import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookSession, holdSeats, seatsLeft } from "@/domain/booking";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("free spots for the pop-up", () => {
  it("counts bookings, friends and held spots; skips past and cancelled classes", async () => {
    const open = await makeSession(h.db, { capacity: 12 });
    const empty = await makeSession(h.db, { capacity: 8 });
    const past = await makeSession(h.db, { capacity: 8, startsAt: hours(-2) });
    const cancelled = await makeSession(h.db, { capacity: 8, status: "cancelled" });

    const admin = await makeUser(h.db);
    await holdSeats(h.db, { sessionId: open.id, userId: admin.id, seats: 7 }, NOW);
    const a = await makeUser(h.db, 5);
    await bookSession(h.db, { userId: a.id, sessionId: open.id, method: "credits", guestName: "Petra" }, NOW);

    const left = await seatsLeft(h.db, [open.id, empty.id, past.id, cancelled.id], NOW);
    expect(Object.fromEntries(left)).toEqual({ [open.id]: 3, [empty.id]: 8 });
    expect((await seatsLeft(h.db, [], NOW)).size).toBe(0);
  });
});
