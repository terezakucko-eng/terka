import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, users } from "@/db/schema";
import { bookSession, cancelBooking, sessionForUser, stornoExceptions as exceptions } from "@/domain/booking";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const balance = async (id: string) =>
  (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;

/** A class 20 h ahead: free to cancel under the default 12 h, late under a lesson's own 24 h. */
async function bookIn20h(ownHours: number | null) {
  const u = await makeUser(h.db, 1);
  const s = await makeSession(h.db, { startsAt: hours(20) });
  await h.db.update(classTypes).set({ cancellationHours: ownHours }).where(eq(classTypes.id, s.classTypeId));
  const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW);
  return { u, s, booking };
}

describe("free cancellation per lesson", () => {
  it("uses the lesson's own window (Reformer, brunch = 24 h)", async () => {
    const { u, s, booking } = await bookIn20h(24);
    const view = (await sessionForUser(h.db, s.id, u.id, NOW))!;
    expect(view.cancellationHours).toBe(24);
    expect(view.lateCancel).toBe(true);

    const r = await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(r.late).toBe(true);
    expect(r.refunded).toBe(false);
    expect(await balance(u.id)).toBe(0);
  });

  it("falls back to the studio default when the lesson has none", async () => {
    const { u, s, booking } = await bookIn20h(null);
    const view = (await sessionForUser(h.db, s.id, u.id, NOW))!;
    expect(view.cancellationHours).toBe(12);
    expect(view.lateCancel).toBe(false);

    const r = await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(r.refunded).toBe(true);
    expect(await balance(u.id)).toBe(1);
  });

  it("lists the exceptions for texts", () => {
    // Czech typography keeps "a" with the next word (non-breaking space)
    const stornoExceptions = (...a: Parameters<typeof exceptions>) => exceptions(...a).replace(/\u00a0/g, " ");
    expect(stornoExceptions([{ name: "Zumba", cancellationHours: null }], 12)).toBe("");
    expect(stornoExceptions([{ name: "Zumba", cancellationHours: 12 }], 12)).toBe("");
    expect(
      stornoExceptions(
        [
          { name: "Reformer fusion", cancellationHours: 24 },
          { name: "Zumba", cancellationHours: null },
          { name: "Fitness brunch", cancellationHours: 24 },
        ],
        12,
      ),
    ).toBe(" (u lekcí Reformer fusion a Fitness brunch 24 h)");
    expect(stornoExceptions([{ name: "Brunch", cancellationHours: 48 }, { name: "Reformer", cancellationHours: 24 }], 12)).toBe(
      " (u lekce Brunch 48 h, u lekce Reformer 24 h)",
    );
  });
});
