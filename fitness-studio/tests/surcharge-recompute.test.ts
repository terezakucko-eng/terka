import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classTypes, entitlements, orders } from "@/db/schema";
import { bookSession, bookingOptions, recomputeSurcharges, unpaidBookings } from "@/domain/booking";
import { createSurchargeOrder, fulfillOrder } from "@/domain/orders";
import { grantEntitlement } from "@/domain/users";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const bookingOf = async (id: string) => (await h.db.select().from(bookings).where(eq(bookings.id, id)))[0];

/** A member books a class whose type has no surcharge (yet). */
async function memberBooking(ct?: string) {
  const s = await makeSession(h.db, ct ? { classTypeId: ct, capacity: 6 } : { capacity: 6 });
  const u = await makeUser(h.db);
  const e = await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 60 }, NOW);
  const opt = (await bookingOptions(h.db, u.id, s)).find((o) => o.method === "membership")!;
  const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: opt.entitlementId }, NOW);
  return { s, u, e, booking };
}

describe("a surcharge set after the class was booked", () => {
  it("applies to upcoming unpaid bookings – then they're listed as unpaid", async () => {
    const { s, booking } = await memberBooking();
    expect((await bookingOf(booking.id)).surcharge).toBe(0);
    await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, s.classTypeId));
    const changed = await recomputeSurcharges(h.db, { classTypeId: s.classTypeId }, NOW);
    expect(changed.map((b) => b.id)).toEqual([booking.id]);
    expect((await bookingOf(booking.id)).surcharge).toBe(10000);
    expect((await unpaidBookings(h.db)).find((b) => b.bookingId === booking.id)).toMatchObject({ kind: "surcharge", amount: 10000, vs: null });
    // nothing changes the second time
    expect(await recomputeSurcharges(h.db, {}, NOW)).toHaveLength(0);
  });

  it("leaves paid ones, lessons the membership includes and past classes alone", async () => {
    const paid = await memberBooking();
    await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, paid.s.classTypeId));
    await recomputeSurcharges(h.db, {}, NOW);
    const o = await createSurchargeOrder(h.db, { userId: paid.u.id, bookingId: paid.booking.id });
    await fulfillOrder(h.db, { orderId: o.id, provider: "transfer" }, NOW);
    await h.db.update(classTypes).set({ memberSurcharge: 15000 }).where(eq(classTypes.id, paid.s.classTypeId));
    await recomputeSurcharges(h.db, {}, NOW);
    expect((await bookingOf(paid.booking.id)).surcharge).toBe(10000);

    // Členství Reformer: the lesson is included – no surcharge
    const inc = await memberBooking(paid.s.classTypeId);
    await h.db.update(entitlements).set({ includedClassTypeId: paid.s.classTypeId, includedPerMonth: 4 }).where(eq(entitlements.id, inc.e.id));
    await h.db.update(bookings).set({ surcharge: 0 }).where(eq(bookings.id, inc.booking.id));
    await recomputeSurcharges(h.db, {}, NOW);
    expect((await bookingOf(inc.booking.id)).surcharge).toBe(0);

    // the class is over
    const past = await memberBooking(paid.s.classTypeId);
    await h.db.update(bookings).set({ surcharge: 0 }).where(eq(bookings.id, past.booking.id));
    await recomputeSurcharges(h.db, {}, new Date(past.s.startsAt.getTime() + 3_600_000));
    expect((await bookingOf(past.booking.id)).surcharge).toBe(0);
  });

  it("a surcharge taken away: the booking owes nothing and its open payment is called off", async () => {
    const { s, u, booking } = await memberBooking();
    await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, s.classTypeId));
    await recomputeSurcharges(h.db, {}, NOW);
    const o = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    await h.db.update(classTypes).set({ memberSurcharge: null }).where(eq(classTypes.id, s.classTypeId));
    await recomputeSurcharges(h.db, {}, NOW);
    expect((await bookingOf(booking.id)).surcharge).toBe(0);
    expect((await h.db.select().from(orders).where(eq(orders.id, o.id)))[0].status).toBe("cancelled");
  });
});
