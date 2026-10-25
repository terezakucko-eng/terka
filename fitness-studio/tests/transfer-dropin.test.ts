import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { bookings, classTypes, orders, users } from "@/db/schema";
import {
  bookSession,
  cancelBooking,
  dropInNotices,
  expireStalePending,
  markLapseAnnounced,
  sessionForUser,
  unannouncedLapses,
} from "@/domain/booking";
import { fulfillOrder } from "@/domain/orders";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const balance = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;
const bookingOf = async (id: string) => (await h.db.select().from(bookings).where(eq(bookings.id, id)))[0];
// the checkout marks the order as a transfer (startCheckout) – the tests do it by hand
const asTransfer = (orderId: string) => h.db.update(orders).set({ provider: "transfer" }).where(eq(orders.id, orderId));

describe("drop-in paid by bank transfer: the place is the client's only once paid", () => {
  it("holds the place for 24 h from booking, waiting for the payment", async () => {
    const s = await makeSession(h.db);
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    expect(booking.status).toBe("pending_payment");
    expect(order!.expiresAt).toEqual(hours(24));
    expect((await sessionForUser(h.db, s.id, u.id, NOW))!.unpaid?.expiresAt).toEqual(hours(24));
  });

  it("close to the class it waits at the latest until 3 h before it", async () => {
    const s = await makeSession(h.db, { startsAt: hours(10) });
    const u = await makeUser(h.db);
    const { order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    expect(order!.expiresAt).toEqual(hours(7));
  });

  it("at the last minute it's card only – unless there are no card payments at all", async () => {
    const s = await makeSession(h.db, { startsAt: hours(2) });
    const u = await makeUser(h.db);
    expect((await sessionForUser(h.db, s.id, u.id, NOW))!.transferUntil).toBeNull();
    await expect(
      bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW),
    ).rejects.toThrow(/kartou/);
    const { order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true, cardAvailable: false }, NOW);
    expect(order!.expiresAt).toEqual(s.startsAt);
  });

  it("cancelling it unpaid just calls the payment off", async () => {
    const s = await makeSession(h.db);
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    const [o] = await h.db.select().from(orders).where(eq(orders.id, order!.id));
    expect(o.status).toBe("cancelled");
    expect(await balance(u.id)).toBe(0);
  });

  it("marked paid, the place is confirmed", async () => {
    const s = await makeSession(h.db);
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    const r = await fulfillOrder(h.db, { orderId: order!.id, provider: "transfer" }, hours(5));
    expect(r.dropIn?.outcome).toBe("confirmed");
    expect((await bookingOf(booking.id)).status).toBe("confirmed");
  });

  it("once paid, an on-time cancel gives the entry back as credit", async () => {
    const s = await makeSession(h.db);
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    await fulfillOrder(h.db, { orderId: order!.id, provider: "manual" }, NOW);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(await balance(u.id)).toBe(s.creditCost);
  });

  it("unpaid by the deadline the place is let go – the client is told once, on the page too", async () => {
    const s = await makeSession(h.db);
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    await asTransfer(order!.id);
    expect((await dropInNotices(h.db, u.id, NOW)).waiting.map((w) => w.orderId)).toEqual([order!.id]);

    const later = hours(25);
    await h.db.transaction((tx) => expireStalePending(tx, later));
    expect((await bookingOf(booking.id)).status).toBe("cancelled");
    expect((await unannouncedLapses(h.db, later)).map((l) => l.orderId)).toContain(order!.id);
    await markLapseAnnounced(h.db, order!.id, later);
    expect((await unannouncedLapses(h.db, later)).map((l) => l.orderId)).not.toContain(order!.id);

    const notices = await dropInNotices(h.db, u.id, later);
    expect(notices.waiting).toHaveLength(0);
    expect(notices.lapsed.map((l) => l.orderId)).toEqual([order!.id]);
    expect((await sessionForUser(h.db, s.id, u.id, later))!.lapsedAt).toEqual(hours(24));

    // booked again → the old lapse is no longer shown
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, later);
    expect((await dropInNotices(h.db, u.id, later)).lapsed).toHaveLength(0);
  });

  it("paid after the deadline: the place comes back when there's room, else credit", async () => {
    const s = await makeSession(h.db, { capacity: 1 });
    const a = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: a.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    await h.db.transaction((tx) => expireStalePending(tx, hours(25)));
    const r = await fulfillOrder(h.db, { orderId: order!.id, provider: "transfer" }, hours(26));
    expect(r.dropIn?.outcome).toBe("confirmed");
    expect((await bookingOf(booking.id)).status).toBe("confirmed");

    const s2 = await makeSession(h.db, { capacity: 1 });
    const b = await makeUser(h.db);
    const c = await makeUser(h.db, 100);
    const late = await bookSession(h.db, { userId: b.id, sessionId: s2.id, method: "drop_in", payLater: true }, NOW);
    await h.db.transaction((tx) => expireStalePending(tx, hours(25)));
    await bookSession(h.db, { userId: c.id, sessionId: s2.id, method: "credits" }, hours(25));
    const r2 = await fulfillOrder(h.db, { orderId: late.order!.id, provider: "transfer" }, hours(26));
    expect(r2.dropIn?.outcome).toBe("credited");
    expect(await balance(b.id)).toBe(s2.creditCost);
  });

  it("a free first visit needs no payment – confirmed at once", async () => {
    const s = await makeSession(h.db);
    await h.db.update(classTypes).set({ firstVisitPrice: 0 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    expect(booking.status).toBe("confirmed");
    expect(order!.status).toBe("paid");
  });
});
