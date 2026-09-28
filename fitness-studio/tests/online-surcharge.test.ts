import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classTypes, massageBookings, massageServices } from "@/db/schema";
import { bookSession, bookingOptions } from "@/domain/booking";
import { addAvailability, bookMassage } from "@/domain/massages";
import { abandonOrder, createMassageOrder, createSurchargeOrder, fulfillOrder } from "@/domain/orders";
import { grantEntitlement } from "@/domain/users";
import { pragueLocalToDate } from "@/lib/dates";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

describe("paying online instead of on site", () => {
  it("member surcharge: one open order per booking, paid → marked on the booking", async () => {
    const s = await makeSession(h.db, { startsAt: pragueLocalToDate("2026-10-08T18:00") });
    await h.db.update(classTypes).set({ memberSurcharge: 9000 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    const other = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const opts = await bookingOptions(h.db, u.id, s);
    expect(opts.find((o) => o.method === "membership")?.detail).toMatch(/kartou nebo převodem/);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: opts[0].entitlementId }, NOW);

    await expect(createSurchargeOrder(h.db, { userId: other.id, bookingId: booking.id })).rejects.toThrow();
    const o1 = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    expect(o1).toMatchObject({ kind: "surcharge", amount: 9000, bookingId: booking.id });
    expect((await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id })).id).toBe(o1.id);

    await abandonOrder(h.db, o1.id); // card checkout closed – booking stays
    const [still] = await h.db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(still.status).toBe("confirmed");

    const o2 = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    expect(o2.id).not.toBe(o1.id);
    await fulfillOrder(h.db, { orderId: o2.id, provider: "transfer" });
    const [paid] = await h.db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(paid.surchargePaidAt).not.toBeNull();
    await expect(createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id })).rejects.toThrow(/zaplacený/);
  });

  it("massage paid by card marks the booking paid", async () => {
    const [svc] = await h.db
      .insert(massageServices)
      .values({ name: "Relax", slug: `m-${Math.random()}`, durationMin: 60, price: 70000 })
      .returning();
    await addAvailability(h.db, { date: "2026-10-06", from: "09:00", to: "18:00", weeks: 1 });
    const u = await makeUser(h.db);
    const b = await bookMassage(h.db, { userId: u.id, serviceId: svc.id, startsAt: pragueLocalToDate("2026-10-06T10:00"), payment: "transfer" }, NOW);
    const o = await createMassageOrder(h.db, { userId: u.id, bookingId: b.id });
    expect(o).toMatchObject({ kind: "massage", amount: 70000 });
    await fulfillOrder(h.db, { orderId: o.id, provider: "stripe", providerRef: "cs_test_1" });
    const [paid] = await h.db.select().from(massageBookings).where(eq(massageBookings.id, b.id));
    expect(paid.paidAt).not.toBeNull();
    await expect(createMassageOrder(h.db, { userId: u.id, bookingId: b.id })).rejects.toThrow(/zaplacená/);
  });
});
