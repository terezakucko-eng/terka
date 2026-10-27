import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
const sent: { id: string; vars: Record<string, string> }[] = [];
vi.mock("@/lib/email-templates", () => ({ sendEmail: vi.fn(async (_to: string, id: string, vars: Record<string, string>) => void sent.push({ id, vars })) }));
vi.mock("@/lib/push", () => ({ pushQuietly: vi.fn(async () => 0) }));

const { bookings, classSessions, classTypes, orders, users } = await import("@/db/schema");
const { bookSession, bookingOfOrder, bookingOptions, cancelBooking, unpaidBookings } = await import("@/domain/booking");
const { createSurchargeOrder, fulfillOrder } = await import("@/domain/orders");
const { grantEntitlement } = await import("@/domain/users");
const { notifyBooked, remindPayment } = await import("@/lib/notify");
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
    // the reminder starts its payment, so there's a VS and a QR code to pay by transfer
    const [started] = await h.db.select().from(orders).where(eq(orders.bookingId, booking.id));
    expect(sent[0].vars.castka).toMatch(new RegExp(`100.*VS ${started.number}`));
    expect(sent[0].vars.odkaz).toContain(`/platba/prevod?order=${started.id}`);
    // once paid there's nothing to remind (the client's own checkout reuses the same payment)
    const o = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    expect(o.id).toBe(started.id);
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

describe("older drop-ins that got the place before paying", () => {
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

  it("are listed as unpaid and a reminder fits a class that's coming or one that's over", async () => {
    const coming = await legacy(48);
    const gone = await legacy(-48);
    const absent = await legacy(-24, "no_show");
    const list = await unpaidBookings(h.db);
    expect(list.map((b) => b.bookingId)).toEqual(expect.arrayContaining([coming.booking.id, gone.booking.id, absent.booking.id]));
    await remindPayment(h.db, coming.booking.id, NOW);
    await remindPayment(h.db, gone.booking.id, NOW);
    const byLink = (o: string) => sent.find((m) => m.vars.odkaz.includes(o))!;
    expect(byLink(coming.order.id).vars.termin).toMatch(/zaplať prosím ještě před lekcí/);
    expect(byLink(gone.order.id).vars.termin).toMatch(/Lekce už proběhla/);
  });

  it("a new drop-in waiting for its transfer is listed with its deadline", async () => {
    const s = await makeSession(h.db, { startsAt: hours(96) });
    const u = await makeUser(h.db);
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    expect((await unpaidBookings(h.db)).find((b) => b.bookingId === booking.id)).toMatchObject({ status: "pending_payment", kind: "drop_in" });
  });
});

describe("a member's surcharge is asked for right at booking", () => {
  async function surchargeBooking() {
    const s = await makeSession(h.db);
    await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const opt = (await bookingOptions(h.db, u.id, s)).find((o) => o.method === "membership")!;
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: opt.entitlementId }, NOW);
    return { u, booking };
  }

  it("the confirmation carries the VS and where to pay – even with booking e-mails off", async () => {
    const { u, booking } = await surchargeBooking();
    await h.db.update(users).set({ bookingEmails: false }).where(eq(users.id, u.id));
    await notifyBooked(h.db, booking);
    const [o] = await h.db.select().from(orders).where(eq(orders.bookingId, booking.id));
    expect(o).toMatchObject({ kind: "surcharge", status: "pending", amount: 10000 });
    expect(sent).toHaveLength(1);
    expect(sent[0].id).toBe("booked");
    expect(sent[0].vars.doplatek).toContain(`VS ${o.number}`);
    expect(sent[0].vars.doplatek).toContain(`/platba/prevod?order=${o.id}`);
  });
});

describe("a surcharge paid by transfer whose booking lost the paid mark", () => {
  it("isn't listed or reminded as unpaid, and the data fix marks it paid again", async () => {
    const s = await makeSession(h.db);
    await h.db.update(classTypes).set({ memberSurcharge: 10000 }).where(eq(classTypes.id, s.classTypeId));
    const u = await makeUser(h.db);
    await grantEntitlement(h.db, { userId: u.id, kind: "membership", name: "Členství", entries: null, validityDays: 30 }, NOW);
    const opt = (await bookingOptions(h.db, u.id, s)).find((o) => o.method === "membership")!;
    const { booking } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "membership", entitlementId: opt.entitlementId }, NOW);
    const o = await createSurchargeOrder(h.db, { userId: u.id, bookingId: booking.id });
    await fulfillOrder(h.db, { orderId: o.id, provider: "transfer" }, NOW);
    // the green "paid" badge tapped by mistake
    await h.db.update(bookings).set({ surchargePaidAt: null }).where(eq(bookings.id, booking.id));

    expect((await unpaidBookings(h.db)).some((b) => b.bookingId === booking.id)).toBe(false);
    await expect(remindPayment(h.db, booking.id, NOW)).rejects.toThrow(/zaplacená/);

    const fix = readFileSync(new URL("../drizzle/0107_surcharge_paid_from_orders.sql", import.meta.url), "utf8");
    await h.db.execute(sql.raw(fix));
    expect((await bookingOf(booking.id)).surchargePaidAt).not.toBeNull();
  });
});
