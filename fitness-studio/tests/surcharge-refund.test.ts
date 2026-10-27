import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { and, eq } from "drizzle-orm";
import { bookings, classTypes, orders, users } from "@/db/schema";
import { bookSession, bookingOptions, cancelBooking } from "@/domain/booking";
import { createSurchargeOrder, fulfillOrder } from "@/domain/orders";
import { grantEntitlement } from "@/domain/users";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const balance = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;

/** A member books a class with a 100 Kč surcharge (Reformer) through the membership. */
async function memberBooking(pay: boolean) {
  const s = await makeSession(h.db);
  await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, s.classTypeId));
  const u = await makeUser(h.db);
  await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
  const opt = (await bookingOptions(h.db, u.id, s)).find((o) => o.method === "membership")!;
  const booked = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: opt.entitlementId }, NOW);
  const [booking] = await h.db.select().from(bookings).where(eq(bookings.id, booked.booking.id));
  expect(booking.surcharge).toBe(10000);
  const order = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
  if (pay) await fulfillOrder(h.db, { orderId: order.id, provider: "stripe", providerRef: `cs_${order.id}` }, NOW);
  return { u, booking, order };
}

describe("member surcharge on cancel", () => {
  it("cancelled in time: the paid surcharge comes back as credit (1 Kč = 1 kredit)", async () => {
    const { u, booking } = await memberBooking(true);
    const r = await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(r.refunded).toBe(true);
    expect(await balance(u.id)).toBe(100);
  });

  it("cancelled late: the paid surcharge is gone", async () => {
    const { u, booking } = await memberBooking(true);
    const r = await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, hours(40));
    expect(r.late).toBe(true);
    expect(await balance(u.id)).toBe(0);
  });

  it("an unpaid surcharge is just called off – nothing is owed, nothing comes back", async () => {
    const { u, booking, order } = await memberBooking(false);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, hours(40));
    const [o] = await h.db.select().from(orders).where(and(eq(orders.id, order.id)));
    expect(o.status).toBe("cancelled");
    expect(await balance(u.id)).toBe(0);
  });
});
