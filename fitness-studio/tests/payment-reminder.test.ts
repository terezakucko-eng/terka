import { eq } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: { id: string; vars: Record<string, string> }[] = [];
vi.mock("@/lib/email-templates", () => ({ sendEmail: vi.fn(async (_to: string, id: string, vars: Record<string, string>) => void sent.push({ id, vars })) }));
vi.mock("@/lib/push", () => ({ pushQuietly: vi.fn(async () => 0) }));

const { bookings, classSessions, classTypes, orders } = await import("@/db/schema");
const { bookSession, bookingOfOrder, bookingOptions, cancelBooking, unpaidBookings } = await import("@/domain/booking");
const { createSurchargeOrder, fulfillOrder } = await import("@/domain/orders");
const { grantEntitlement } = await import("@/domain/users");
const { PAY_FIRST_SINCE, remindOldUnpaid, remindPayment } = await import("@/lib/notify");
const { NOW, hours, makeSession, makeUser, testDb } = await import("./helpers");

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());
beforeEach(() => void (sent.length = 0));

const bookingOf = async (id: string) => (await h.db.select().from(bookings).where(eq(bookings.id, id)))[0];

describe("reception reminds an unpaid booking", () => {
  it("a drop-in by transfer: when to pay, a link to the class, and the time it was sent", async () => {
    const s = await makeSession(h.db, { startsAt: hours(96) });
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    await h.db.update(orders).set({ provider: "transfer" }).where(eq(orders.id, order!.id));
    // found from the payment lists too
    expect(await bookingOfOrder(h.db, order!.id)).toBe(booking.id);
    await remindPayment(h.db, booking.id, NOW);
    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ id: "paymentReminder", vars: { co: "platba za lekci" } });
    expect(sent[0].vars.castka).toMatch(/250/);
    expect(sent[0].vars.termin).toMatch(/Zaplať ji prosím do/);
    expect(sent[0].vars.odkaz).toContain(`/platba/prevod?order=${order!.id}`);
    expect((await bookingOf(booking.id)).paymentRemindedAt).toEqual(NOW);
  });

  it("a member's surcharge – even without an order yet", async () => {
    const s = await makeSession(h.db);
    await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const opt = (await bookingOptions(h.db, u.id, s)).find((o) => o.method === "membership")!;
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: opt.entitlementId }, NOW);
    await remindPayment(h.db, booking.id, NOW);
    expect(sent[0].vars).toMatchObject({ co: "doplatek k lekci" });
    expect(sent[0].vars.castka).toMatch(/100/);
    // once paid there's nothing to remind
    const o = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    expect(await bookingOfOrder(h.db, o.id)).toBe(booking.id);
    await fulfillOrder(h.db, { orderId: o.id, provider: "transfer" }, NOW);
    await expect(remindPayment(h.db, booking.id, NOW)).rejects.toThrow(/zaplacená/);
  });

  it("not for a cancelled booking or a class that already started", async () => {
    const s = await makeSession(h.db, { startsAt: hours(96) });
    const u = await makeUser(h.db);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    await expect(remindPayment(h.db, booking.id, hours(97))).rejects.toThrow(/začala/);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    await expect(remindPayment(h.db, booking.id, NOW)).rejects.toThrow(/zrušená/);
    expect(sent).toHaveLength(0);
  });
});

describe("older bookings that got the place before paying", () => {
  /** A drop-in from before the pay-first change: confirmed right away, its transfer still pending. */
  async function legacy(startsIn: number, status: "confirmed" | "no_show" = "confirmed") {
    const s = await makeSession(h.db, { startsAt: hours(96) });
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    await h.db.update(classSessions).set({ startsAt: hours(startsIn) }).where(eq(classSessions.id, s.id));
    await h.db.update(orders).set({ provider: "transfer", expiresAt: null }).where(eq(orders.id, order!.id));
    await h.db.update(bookings).set({ status, createdAt: new Date("2026-10-20T10:00:00+02:00") }).where(eq(bookings.id, booking.id));
    return { s, booking, order: order! };
  }

  it("are listed and each gets one reminder in the daytime – a no-show isn't chased", async () => {
    const coming = await legacy(48);
    const gone = await legacy(-48);
    const absent = await legacy(-24, "no_show");
    const list = await unpaidBookings(h.db, { createdBefore: PAY_FIRST_SINCE });
    expect(list.map((b) => b.bookingId)).toEqual(expect.arrayContaining([coming.booking.id, gone.booking.id, absent.booking.id]));

    // at night nothing goes out
    expect(await remindOldUnpaid(h.db, new Date("2026-10-05T21:00:00Z"))).toBe(0);
    expect(await remindOldUnpaid(h.db, NOW)).toBe(2);
    const byLink = (o: string) => sent.find((m) => m.vars.odkaz.includes(o))!;
    expect(byLink(coming.order.id).vars.termin).toMatch(/zaplať prosím ještě před lekcí/);
    expect(byLink(gone.order.id).vars.termin).toMatch(/Lekce už proběhla/);
    expect((await bookingOf(absent.booking.id)).paymentRemindedAt).toBeNull();
    // once only
    expect(await remindOldUnpaid(h.db, NOW)).toBe(0);
  });

  it("new bookings (after the change) are left to the regular flow", async () => {
    const s = await makeSession(h.db, { startsAt: hours(96) });
    const u = await makeUser(h.db);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    expect((await unpaidBookings(h.db, { createdBefore: PAY_FIRST_SINCE })).some((b) => b.bookingId === booking.id)).toBe(false);
    expect((await unpaidBookings(h.db)).some((b) => b.bookingId === booking.id)).toBe(true);
  });
});
