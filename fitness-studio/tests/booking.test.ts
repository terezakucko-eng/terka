import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, entitlements, users } from "@/db/schema";
import {
  adminAddBooking,
  bookSession,
  bookingOptions,
  cancelBooking,
  cancelSession,
  joinWaitlist,
  sessionForUser,
} from "@/domain/booking";
import {
  createProductOrder,
  fulfillOrder,
  renewMembership,
} from "@/domain/orders";
import { grantEntitlement, registerUser } from "@/domain/users";
import { NOW, hours, makeProduct, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const balance = async (id: string) =>
  (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;

describe("credits", () => {
  it("charges and refunds credits on timely cancellation", async () => {
    const u = await makeUser(h.db, 3);
    const s = await makeSession(h.db, { creditCost: 2 });
    const { booking } = await bookSession(
      h.db,
      { userId: u.id, sessionId: s.id, method: "credits" },
      NOW,
    );
    expect(booking.status).toBe("confirmed");
    expect(await balance(u.id)).toBe(1);

    const r = await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(r.refunded).toBe(true);
    expect(await balance(u.id)).toBe(3);
  });

  it("keeps credits on late cancellation", async () => {
    const u = await makeUser(h.db, 1);
    const s = await makeSession(h.db, { startsAt: hours(5) });
    const { booking } = await bookSession(
      h.db,
      { userId: u.id, sessionId: s.id, method: "credits" },
      NOW,
    );
    const r = await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(r.late).toBe(true);
    expect(r.refunded).toBe(false);
    expect(await balance(u.id)).toBe(0);
  });

  it("rejects booking without enough credit", async () => {
    const u = await makeUser(h.db, 0);
    const s = await makeSession(h.db);
    await expect(
      bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW),
    ).rejects.toThrow(/kreditu/);
  });

  it("prevents double booking", async () => {
    const u = await makeUser(h.db, 5);
    const s = await makeSession(h.db);
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW);
    await expect(
      bookSession(h.db, { userId: u.id, sessionId: s.id, method: "credits" }, NOW),
    ).rejects.toThrow(/už jsi/);
  });
});

describe("capacity & waitlist", () => {
  it("fills up, queues, and promotes from the waitlist with auto-charge", async () => {
    const s = await makeSession(h.db, { capacity: 1 });
    const a = await makeUser(h.db, 1);
    const b = await makeUser(h.db, 1);
    const { booking } = await bookSession(
      h.db,
      { userId: a.id, sessionId: s.id, method: "credits" },
      NOW,
    );
    await expect(
      bookSession(h.db, { userId: b.id, sessionId: s.id, method: "credits" }, NOW),
    ).rejects.toThrow(/plná/);

    const w = await joinWaitlist(h.db, { userId: b.id, sessionId: s.id }, NOW);
    expect(w.status).toBe("waitlist");
    expect(await balance(b.id)).toBe(1);

    const r = await cancelBooking(h.db, { bookingId: booking.id, actorId: a.id }, NOW);
    expect(r.promoted.map((p) => p.userId)).toEqual([b.id]);
    expect(await balance(b.id)).toBe(0);
    const [bw] = await h.db.select().from(bookings).where(eq(bookings.id, w.id));
    expect(bw.status).toBe("confirmed");
  });

  it("does not book outside the booking window or in the past", async () => {
    const u = await makeUser(h.db, 5);
    const far = await makeSession(h.db, { startsAt: hours(24 * 60) });
    const past = await makeSession(h.db, { startsAt: hours(-1) });
    await expect(
      bookSession(h.db, { userId: u.id, sessionId: far.id, method: "credits" }, NOW),
    ).rejects.toThrow(/otevřené/);
    await expect(
      bookSession(h.db, { userId: u.id, sessionId: past.id, method: "credits" }, NOW),
    ).rejects.toThrow(/proběhla/);
  });
});

describe("passes, memberships, free entries", () => {
  it("welcome free entry is granted at registration and consumed", async () => {
    const u = await registerUser(
      h.db,
      { email: "Nova@Test.cz", name: "Nová", passwordHash: "x" },
      NOW,
    );
    expect(u.email).toBe("nova@test.cz");
    const s = await makeSession(h.db);
    const opts = await bookingOptions(h.db, u.id, s);
    const free = opts.find((o) => o.method === "free")!;
    expect(free.disabled).toBeUndefined();
    await bookSession(
      h.db,
      { userId: u.id, sessionId: s.id, method: "free", entitlementId: free.entitlementId },
      NOW,
    );
    const s2 = await makeSession(h.db);
    const opts2 = await bookingOptions(h.db, u.id, s2);
    expect(opts2.find((o) => o.method === "free")?.disabled).toMatch(/Vyčerpané/);
  });

  it("pass purchase grants entries that are used and returned", async () => {
    const u = await makeUser(h.db);
    const p = await makeProduct(h.db, { kind: "pass", entries: 2, validityDays: 60 });
    const { order } = await createProductOrder(h.db, { userId: u.id, productId: p.id }, NOW);
    await fulfillOrder(h.db, { orderId: order.id, provider: "mock", providerRef: "x1" }, NOW);
    // idempotent
    const again = await fulfillOrder(h.db, { orderId: order.id, provider: "mock" }, NOW);
    expect(again.alreadyPaid).toBe(true);

    const ents = await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
    expect(ents).toHaveLength(1);
    const s = await makeSession(h.db);
    const { booking } = await bookSession(
      h.db,
      { userId: u.id, sessionId: s.id, method: "pass", entitlementId: ents[0].id },
      NOW,
    );
    let [e] = await h.db.select().from(entitlements).where(eq(entitlements.id, ents[0].id));
    expect(e.entriesUsed).toBe(1);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    [e] = await h.db.select().from(entitlements).where(eq(entitlements.id, ents[0].id));
    expect(e.entriesUsed).toBe(0);
  });

  it("membership respects weekly limit", async () => {
    const u = await makeUser(h.db);
    const e = await grantEntitlement(
      h.db,
      { userId: u.id, kind: "membership", name: "Členství 2×", entries: null, validityDays: 30, weeklyLimit: 1 },
      NOW,
    );
    const s1 = await makeSession(h.db, { startsAt: hours(24) });
    const s2 = await makeSession(h.db, { startsAt: hours(30) });
    await bookSession(
      h.db,
      { userId: u.id, sessionId: s1.id, method: "membership", entitlementId: e.id },
      NOW,
    );
    await expect(
      bookSession(
        h.db,
        { userId: u.id, sessionId: s2.id, method: "membership", entitlementId: e.id },
        NOW,
      ),
    ).rejects.toThrow(/limit/);
  });

  it("membership renewal creates a new period once per invoice", async () => {
    const u = await makeUser(h.db);
    const p = await makeProduct(h.db, { kind: "membership", validityDays: 30, recurring: true });
    const { order } = await createProductOrder(h.db, { userId: u.id, productId: p.id }, NOW);
    await fulfillOrder(
      h.db,
      { orderId: order.id, provider: "stripe", providerRef: "cs_1", subscriptionId: "sub_1" },
      NOW,
    );
    const input = {
      provider: "stripe",
      subscriptionId: "sub_1",
      invoiceId: "in_2",
      amount: 100000,
      periodStart: hours(24 * 30),
      periodEnd: hours(24 * 60),
    };
    expect(await renewMembership(h.db, input)).not.toBeNull();
    expect(await renewMembership(h.db, input)).toBeNull();
    const ents = await h.db.select().from(entitlements).where(eq(entitlements.userId, u.id));
    expect(ents).toHaveLength(2);
  });
});

describe("drop-in & free classes", () => {
  it("holds the spot while paying, confirms after payment", async () => {
    const u = await makeUser(h.db);
    const s = await makeSession(h.db, { capacity: 1 });
    const { booking, order } = await bookSession(
      h.db,
      { userId: u.id, sessionId: s.id, method: "drop_in" },
      NOW,
    );
    expect(booking.status).toBe("pending_payment");
    expect(order!.amount).toBe(25000);
    const other = await makeUser(h.db, 5);
    await expect(
      bookSession(h.db, { userId: other.id, sessionId: s.id, method: "credits" }, NOW),
    ).rejects.toThrow(/plná/);

    await fulfillOrder(h.db, { orderId: order!.id, provider: "mock" }, NOW);
    const [b] = await h.db.select().from(bookings).where(eq(bookings.id, booking.id));
    expect(b.status).toBe("confirmed");
  });

  it("releases an unpaid spot after the hold expires", async () => {
    const u = await makeUser(h.db);
    const s = await makeSession(h.db, { capacity: 1 });
    await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in" }, NOW);
    const other = await makeUser(h.db, 5);
    const later = new Date(NOW.getTime() + 31 * 60_000);
    const { booking } = await bookSession(
      h.db,
      { userId: other.id, sessionId: s.id, method: "credits" },
      later,
    );
    expect(booking.status).toBe("confirmed");
  });

  it("free class needs no payment", async () => {
    const u = await makeUser(h.db);
    const s = await makeSession(h.db, { isFree: true });
    const opts = await bookingOptions(h.db, u.id, s);
    expect(opts.map((o) => o.method)).toEqual(["free_class"]);
    const { booking } = await bookSession(
      h.db,
      { userId: u.id, sessionId: s.id, method: "free_class" },
      NOW,
    );
    expect(booking.status).toBe("confirmed");
  });
});

describe("admin", () => {
  it("cancelling a class refunds everyone", async () => {
    const s = await makeSession(h.db, { capacity: 5 });
    const a = await makeUser(h.db, 1);
    const b = await makeUser(h.db, 0);
    await bookSession(h.db, { userId: a.id, sessionId: s.id, method: "credits" }, NOW);
    await bookSession(h.db, { userId: b.id, sessionId: s.id, method: "drop_in" }, NOW)
      .then(({ order }) => fulfillOrder(h.db, { orderId: order!.id, provider: "mock" }, NOW));
    const r = await cancelSession(h.db, s.id, NOW);
    expect(r.affected).toHaveLength(2);
    expect(await balance(a.id)).toBe(1);
    expect(await balance(b.id)).toBe(1); // drop-in returned as credit
    const view = await sessionForUser(h.db, s.id, a.id, NOW);
    expect(view!.state).toBe("cancelled");
  });

  it("reception can add a client over capacity without charge", async () => {
    const s = await makeSession(h.db, { capacity: 1 });
    const a = await makeUser(h.db, 1);
    const b = await makeUser(h.db, 0);
    await bookSession(h.db, { userId: a.id, sessionId: s.id, method: "credits" }, NOW);
    const bk = await adminAddBooking(h.db, { sessionId: s.id, userId: b.id, mode: "admin" }, NOW);
    expect(bk.status).toBe("confirmed");
    await expect(
      adminAddBooking(h.db, { sessionId: s.id, userId: (await makeUser(h.db)).id, mode: "auto" }, NOW),
    ).rejects.toThrow(/nemá čím/);
  });
});
