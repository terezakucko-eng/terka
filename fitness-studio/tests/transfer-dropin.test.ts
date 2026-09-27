import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { orders, users } from "@/db/schema";
import { bookSession, cancelBooking } from "@/domain/booking";
import { fulfillOrder } from "@/domain/orders";
import { NOW, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const balance = async (id: string) => (await h.db.select().from(users).where(eq(users.id, id)))[0].creditBalance;

describe("drop-in paid later by bank transfer", () => {
  it("books the spot at once; cancelling unpaid just calls the payment off", async () => {
    const s = await makeSession(h.db);
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    expect(booking.status).toBe("confirmed");
    expect(order!.expiresAt).toBeNull();
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    const [o] = await h.db.select().from(orders).where(eq(orders.id, order!.id));
    expect(o.status).toBe("cancelled");
    expect(await balance(u.id)).toBe(0);
  });

  it("once paid, an on-time cancel gives the entry back as credit", async () => {
    const s = await makeSession(h.db);
    const u = await makeUser(h.db);
    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    await fulfillOrder(h.db, { orderId: order!.id, provider: "manual" }, NOW);
    await cancelBooking(h.db, { bookingId: booking.id, actorId: u.id }, NOW);
    expect(await balance(u.id)).toBe(s.creditCost);
  });
});
