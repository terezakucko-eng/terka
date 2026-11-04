import { and, eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { announcements, bookings, orders, sessionBundles, users, type ClassSession } from "@/db/schema";
import {
  bookSession,
  bookingOptions,
  cancelBooking,
  cancelSession,
  expireStalePending,
  occupancy,
  sessionForUser,
  transfersToCheck,
  unpaidBookings,
} from "@/domain/booking";
import { fulfillOrder } from "@/domain/orders";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const balance = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;
const placesOf = (orderId: string) => h.db.select().from(bookings).where(eq(bookings.orderId, orderId));

/** Two lessons one after the other (16:00 and 17:00 in Prague), both for 300 Kč together. */
async function event(over: { capacity?: number } = {}) {
  const [bundle] = await h.db.insert(sessionBundles).values({ name: "Zumba SPECIAL – obě lekce", price: 30000 }).returning();
  const common = { capacity: over.capacity ?? 10, creditCost: 220, dropInPrice: 25000, bundleId: bundle.id, noFreeEntry: true };
  const toning = await makeSession(h.db, { ...common, startsAt: hours(30), title: "Zumba Toning SPECIAL" });
  const fitness = await makeSession(h.db, { ...common, startsAt: hours(31), title: "Zumba fitness SPECIAL" });
  return { bundle, toning, fitness };
}
const bundleOpt = async (userId: string, s: ClassSession, seats = 1) => (await bookingOptions(h.db, userId, s, seats, NOW)).find((o) => o.bundle);

describe("a bundle: both lessons of an event by one payment", () => {
  it("is offered on each lesson, before the single drop-in – credits stay per lesson", async () => {
    const { toning, fitness } = await event();
    const u = await makeUser(h.db, 1000);
    for (const s of [toning, fitness]) {
      const opts = await bookingOptions(h.db, u.id, s, 1, NOW);
      const i = opts.findIndex((o) => o.bundle);
      expect(opts[i]).toMatchObject({ method: "drop_in", detail: "Zumba Toning SPECIAL i Zumba fitness SPECIAL jednou platbou." });
      expect(opts[i].label).toMatch(/^Obě lekce \(16:00 \+ 17:00\) za 300\sKč$/);
      expect(opts[i].disabled).toBeUndefined();
      // the single lesson still costs its usual price, right after the bundle
      expect(opts[i + 1].label).toMatch(/^Jen tahle lekce 250\sKč$/);
      expect(opts.find((o) => o.method === "credits")?.label).toMatch(/220 kreditů/);
    }
    // a friend coming along pays per lesson – no bundle for two
    expect(await bundleOpt(u.id, toning, 2)).toBeUndefined();
  });

  it("books both places at once and one payment of 300 Kč confirms them", async () => {
    const { toning, fitness } = await event();
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: fitness.id, method: "drop_in", bundle: true }, NOW);
    expect(order).toMatchObject({ amount: 30000, description: "Zumba SPECIAL – obě lekce", sessionId: toning.id });
    expect(booking).toMatchObject({ sessionId: fitness.id, status: "pending_payment", orderId: order!.id });
    const held = await placesOf(order!.id);
    expect(held.map((b) => b.sessionId).sort()).toEqual([toning.id, fitness.id].sort());
    expect(held.every((b) => b.status === "pending_payment")).toBe(true);
    expect(await occupancy(h.db, toning.id)).toBe(1);
    // the page of either lesson waits for the same payment – cancelling there says it goes for both
    expect((await sessionForUser(h.db, toning.id, u.id, NOW))!.unpaid).toMatchObject({ id: order!.id, lessons: 2 });

    const paid = await fulfillOrder(h.db, { orderId: order!.id, provider: "test" }, NOW);
    expect(paid.dropIn).toMatchObject({ outcome: "confirmed", credit: 0 });
    expect(paid.dropIn!.bookings!.map((b) => b.sessionId)).toEqual([toning.id, fitness.id]);
    expect((await placesOf(order!.id)).every((b) => b.status === "confirmed")).toBe(true);

    // one lesson cancelled in time gives back its half of the price as credit
    const r = await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(r).toMatchObject({ refunded: true, released: [] });
    expect(await balance(u.id)).toBe(150);
    expect((await placesOf(order!.id)).find((b) => b.sessionId === toning.id)!.status).toBe("confirmed");
  });

  it("an unpaid bundle is called off as a whole – both places come free", async () => {
    const { toning, fitness } = await event();
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: toning.id, method: "drop_in", bundle: true, payLater: true }, NOW);
    const r = await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(r.released.map((b) => b.sessionId)).toEqual([fitness.id]);
    expect((await placesOf(order!.id)).every((b) => b.status === "cancelled")).toBe(true);
    expect((await h.db.select().from(orders).where(eq(orders.id, order!.id)))[0].status).toBe("cancelled");
    expect(await occupancy(h.db, fitness.id)).toBe(0);
    // the transfer that comes anyway is credit – each lesson's share, at most its credit price
    const late = await fulfillOrder(h.db, { orderId: order!.id, provider: "transfer" }, NOW);
    expect(late.dropIn).toMatchObject({ outcome: "credited", credit: 300 });
    expect(await balance(u.id)).toBe(300);
  });

  it("not paid in time: both places lapse – a late payment takes them back while there's room", async () => {
    const { toning, fitness } = await event();
    const u = await makeUser(h.db);
    const { order } = await bookSession(h.db, { userId: u.id, sessionId: toning.id, method: "drop_in", bundle: true, payLater: true }, NOW);
    await h.db.update(orders).set({ provider: "transfer" }).where(eq(orders.id, order!.id));
    // the hold runs out – noticed from the other lesson too (the order sits on the first one)
    await h.db.transaction((tx) => expireStalePending(tx, hours(29), fitness.id));
    expect((await placesOf(order!.id)).every((b) => b.status === "cancelled")).toBe(true);
    const back = await fulfillOrder(h.db, { orderId: order!.id, provider: "reception" }, hours(29));
    expect(back.dropIn).toMatchObject({ outcome: "confirmed" });
    expect((await placesOf(order!.id)).every((b) => b.status === "confirmed")).toBe(true);
  });

  it("can't be booked when the other lesson is full or already booked – then each is paid on its own", async () => {
    const { toning, fitness } = await event({ capacity: 1 });
    const [first, second] = [await makeUser(h.db, 500), await makeUser(h.db)];
    await bookSession(h.db, { userId: first.id, sessionId: fitness.id, method: "credits" }, NOW);
    expect((await bundleOpt(first.id, toning))?.disabled).toMatch(/Zumba fitness SPECIAL už jsi přihlášená/);
    expect((await bundleOpt(second.id, toning))?.disabled).toMatch(/Zumba fitness SPECIAL je už plná/);
    await expect(bookSession(h.db, { userId: second.id, sessionId: toning.id, method: "drop_in", bundle: true }, NOW)).rejects.toThrow(/plná/);
    // nothing was held meanwhile
    expect(await occupancy(h.db, toning.id)).toBe(0);
  });

  it("the payment lists show one line per bundle, both lessons named", async () => {
    const { toning } = await event();
    const u = await makeUser(h.db);
    const { order } = await bookSession(h.db, { userId: u.id, sessionId: toning.id, method: "drop_in", bundle: true, payLater: true }, NOW);
    await h.db.update(orders).set({ provider: "transfer" }).where(eq(orders.id, order!.id));
    const mine = (await unpaidBookings(h.db)).filter((r) => r.orderId === order!.id);
    expect(mine).toHaveLength(1);
    expect(mine[0]).toMatchObject({ name: "Zumba Toning SPECIAL + Zumba fitness SPECIAL", amount: 30000 });
    const checks = (await transfersToCheck(h.db, NOW)).filter((r) => r.orderId === order!.id);
    expect(checks).toHaveLength(1);
    expect(checks[0].name).toBe("Zumba Toning SPECIAL + Zumba fitness SPECIAL");
  });

  it("the studio cancelling one lesson lets an unpaid bundle's other place go too", async () => {
    const { toning, fitness } = await event();
    const u = await makeUser(h.db);
    const { order } = await bookSession(h.db, { userId: u.id, sessionId: fitness.id, method: "drop_in", bundle: true, payLater: true }, NOW);
    const r = await cancelSession(h.db, toning.id, NOW);
    expect(r.released.map((b) => b.sessionId)).toEqual([fitness.id]);
    const left = await h.db.select().from(bookings).where(and(eq(bookings.orderId, order!.id), eq(bookings.sessionId, fitness.id)));
    expect(left[0].status).toBe("cancelled");
    // with the toning gone there's no bundle any more – the fitness is paid on its own
    expect(await bundleOpt(u.id, (await sessionForUser(h.db, fitness.id, u.id, NOW))!.session)).toBeUndefined();
  });
});

describe("migration 0146: the Zumba SPECIAL bundle", () => {
  it("is 300 Kč for both lessons and the board post says so", async () => {
    const [b] = await h.db.select().from(sessionBundles).where(eq(sessionBundles.id, "3ba8adce-7a55-4a8c-a417-8cc60cc88cea"));
    expect(b).toMatchObject({ name: "Zumba SPECIAL – obě lekce", price: 30000 });
    const [post] = await h.db.select().from(announcements).where(eq(announcements.id, "146aa9e2-80ab-437c-b082-47ecb7403616"));
    expect(post.body).toContain("<li>jednorázově 250 Kč či 220 kreditů</li><li>balíček na obě za <strong>300 Kč</strong> – zaplatíš kartou nebo převodem</li>");
    expect(post.body.match(/300 Kč/g)).toHaveLength(1);
  });
});
