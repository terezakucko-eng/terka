import { eq } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, orders } from "@/db/schema";
import { changeCredits } from "@/domain/wallet";
import { bookingPayments, ledgerTrail, orderTrail, paymentLine } from "@/lib/payment-trail";
import { userLedger } from "@/lib/account";
import { makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

const nbsp = (s: string) => s.replace(/ (?=Kč)/g, " ");

describe("client card: where every crown went", () => {
  it("a surcharge paid by transfer shows its VS – on the lesson, the payment and the credit", async () => {
    const u = await makeUser(h.db);
    const s = await makeSession(h.db, { title: "Reformer fusion" });
    const [b] = await h.db
      .insert(bookings)
      .values({ userId: u.id, sessionId: s.id, status: "confirmed", method: "membership", surcharge: 10000, surchargePaidAt: new Date() })
      .returning();
    const [o] = await h.db
      .insert(orders)
      .values({ userId: u.id, kind: "surcharge", bookingId: b.id, description: "Doplatek – Reformer fusion", amount: 10000, provider: "transfer", status: "paid", paidAt: new Date() })
      .returning();

    const pays = await bookingPayments(h.db, [b.id]);
    expect(paymentLine(b, pays.get(b.id))).toEqual({ text: nbsp(`Doplatek 100 Kč zaplacen převodem · VS ${o.number}`), paid: true });

    const trail = await orderTrail(h.db, [o.id]);
    expect(trail.lessons.get(o.id)).toMatchObject({ id: s.id, name: "Reformer fusion" });
    expect(trail.credited.size).toBe(0);

    // money that came for nothing left to pay goes to credit – the card says so, and what it came from
    await changeCredits(h.db, { userId: u.id, delta: 100, reason: "refund", orderId: o.id, note: "Doplatek už nebyl potřeba – vrácen jako kredit" });
    expect((await orderTrail(h.db, [o.id])).credited.get(o.id)).toBe(100);
    const ledger = await userLedger(h.db, u.id);
    expect((await ledgerTrail(h.db, ledger)).get(ledger[0].id)).toMatchObject({ vs: o.number, lesson: { id: s.id } });
  });

  it("an unpaid surcharge waiting for a transfer offers it to be confirmed by its VS", async () => {
    const u = await makeUser(h.db, 500);
    const s = await makeSession(h.db);
    const [b] = await h.db.insert(bookings).values({ userId: u.id, sessionId: s.id, status: "confirmed", method: "membership", surcharge: 10000 }).returning();
    expect(paymentLine(b, (await bookingPayments(h.db, [b.id])).get(b.id))).toEqual({
      text: nbsp("Doplatek 100 Kč nezaplacen"),
      paid: false,
      pendingOrderId: undefined,
      pendingVs: undefined,
    });
    const [o] = await h.db
      .insert(orders)
      .values({ userId: u.id, kind: "surcharge", bookingId: b.id, description: "Doplatek", amount: 10000, provider: "transfer" })
      .returning();
    expect(paymentLine(b, (await bookingPayments(h.db, [b.id])).get(b.id))).toMatchObject({
      text: nbsp(`Doplatek 100 Kč nezaplacen · čeká na převod VS ${o.number}`),
      pendingOrderId: o.id,
      pendingVs: o.number,
    });
  });

  it("paid from credit or at the desk says so; a drop-in by card; nothing for a plain membership or the waitlist", async () => {
    const u = await makeUser(h.db, 500);
    const s = await makeSession(h.db);
    const [fromCredit, atDesk, plain, waiting] = await h.db
      .insert(bookings)
      .values([
        { userId: u.id, sessionId: s.id, status: "attended", method: "membership", surcharge: 10000, surchargePaidAt: new Date() },
        { userId: u.id, sessionId: (await makeSession(h.db)).id, status: "confirmed", method: "pass", surcharge: 15000, surchargePaidAt: new Date() },
        { userId: u.id, sessionId: (await makeSession(h.db)).id, status: "confirmed", method: "membership" },
        { userId: u.id, sessionId: (await makeSession(h.db)).id, status: "waitlist", surcharge: 10000 },
      ])
      .returning();
    await changeCredits(h.db, { userId: u.id, delta: -100, reason: "booking", bookingId: fromCredit.id, note: "Doplatek 100 Kč zaplacen z kreditu" });
    const [dropIn] = await h.db.insert(bookings).values({ userId: u.id, sessionId: (await makeSession(h.db)).id, status: "confirmed", method: "drop_in" }).returning();
    const [card] = await h.db
      .insert(orders)
      .values({ userId: u.id, kind: "drop_in", sessionId: dropIn.sessionId, description: "Lekce", amount: 25000, provider: "stripe", status: "paid" })
      .returning();
    await h.db.update(bookings).set({ orderId: card.id }).where(eq(bookings.id, dropIn.id));

    const pays = await bookingPayments(h.db, [fromCredit.id, atDesk.id, plain.id, waiting.id, dropIn.id]);
    expect(paymentLine(fromCredit, pays.get(fromCredit.id))?.text).toBe(nbsp("Doplatek 100 Kč zaplacen z kreditu"));
    expect(paymentLine(atDesk, pays.get(atDesk.id))?.text).toBe(nbsp("Doplatek 150 Kč zaplacen na místě"));
    expect(paymentLine(plain, pays.get(plain.id))).toBeNull();
    expect(paymentLine(waiting, pays.get(waiting.id))).toBeNull();
    expect(paymentLine({ ...dropIn, orderId: card.id }, pays.get(dropIn.id))).toEqual({ text: "Zaplaceno kartou", paid: true });
  });
});
