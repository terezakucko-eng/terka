import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, classSessions, classTypes } from "@/db/schema";
import { adminAddBooking, bookSession, bookingOptions, changeBookingPayment, joinWaitlist } from "@/domain/booking";
import { grantEntitlement } from "@/domain/users";
import { NOW, hours, makeSession, makeUser, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

/** A client who has everything: membership, pass, a free entry and plenty of credit. */
async function wellOff() {
  const u = await makeUser(h.db, 5000);
  const grant = (kind: "membership" | "pass" | "free", entries: number | null) =>
    grantEntitlement(h.db, { userId: u.id, kind, name: kind, entries, validityDays: 60 }, NOW);
  return { u, membership: await grant("membership", null), pass: await grant("pass", 10), free: await grant("free", 1) };
}

/** A charity class: 150 Kč, only by card or transfer; the class type has an intro, a student and a duo price. */
async function charity(over: Partial<typeof classSessions.$inferInsert> = {}) {
  const s = await makeSession(h.db, { capacity: 10, startsAt: hours(60), dropInPrice: 15000, dropInOnly: true, ribbon: true, ...over });
  await h.db.update(classTypes).set({ firstVisitPrice: 10000, studentDropInPrice: 12000, duoPrice: 20000 }).where(eq(classTypes.id, s.classTypeId));
  return s;
}

describe("a class paid only by card or transfer (charity)", () => {
  it("offers just the entry fee – no membership, pass, free entry, credit, intro or student price", async () => {
    const { u } = await wellOff();
    const s = await charity();
    const opts = await bookingOptions(h.db, u.id, s, 1, NOW);
    expect(opts.map((o) => [o.method, o.label])).toEqual([["drop_in", "Jednorázový vstup 150 Kč"]]);
    // for two it's simply twice the fee, not the class's duo deal
    const duo = await bookingOptions(h.db, u.id, s, 2, NOW);
    expect(duo.map((o) => [o.method, o.label])).toEqual([["drop_in", "Jednorázově pro dva 300 Kč"]]);
  });

  it("books by card or transfer and refuses everything else", async () => {
    const { u, membership, pass, free } = await wellOff();
    const s = await charity();
    for (const [method, entitlementId] of [["membership", membership.id], ["pass", pass.id], ["free", free.id], ["credits", undefined]] as const)
      await expect(bookSession(h.db, { userId: u.id, sessionId: s.id, method, entitlementId }, NOW)).rejects.toThrow(/jen kartou nebo převodem/);
    await expect(bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", student: true }, NOW)).rejects.toThrow(/studentský vstup není/);

    const { booking, order } = await bookSession(h.db, { userId: u.id, sessionId: s.id, method: "drop_in", payLater: true }, NOW);
    expect(booking.status).toBe("pending_payment");
    expect(order?.amount).toBe(15000);
  });

  it("reception can add a client only without payment, and can't switch the payment to a membership", async () => {
    const { u, membership } = await wellOff();
    const s = await charity();
    await expect(adminAddBooking(h.db, { sessionId: s.id, userId: u.id, pay: "auto" }, NOW)).rejects.toThrow(/jen kartou nebo převodem/);
    await expect(adminAddBooking(h.db, { sessionId: s.id, userId: u.id, pay: { method: "membership", entitlementId: membership.id } }, NOW)).rejects.toThrow(/jen kartou nebo převodem/);
    const b = await adminAddBooking(h.db, { sessionId: s.id, userId: u.id, pay: "admin" }, NOW);
    expect(b.method).toBe("admin");
    await expect(changeBookingPayment(h.db, { bookingId: b.id, pay: { method: "membership", entitlementId: membership.id }, isAdmin: true }, NOW)).rejects.toThrow(/jen kartou nebo převodem/);
    expect((await h.db.select().from(bookings).where(eq(bookings.id, b.id)))[0].method).toBe("admin");
  });

  it("has no waitlist – a freed place can't be charged automatically", async () => {
    const s = await charity({ capacity: 1 });
    const first = await wellOff();
    await adminAddBooking(h.db, { sessionId: s.id, userId: first.u.id, pay: "admin" }, NOW);
    const { u } = await wellOff();
    await expect(joinWaitlist(h.db, { userId: u.id, sessionId: s.id }, NOW)).rejects.toThrow(/pořadník není/);
  });

  it("an ordinary class of the same kind still takes the membership", async () => {
    const { u } = await wellOff();
    const s = await makeSession(h.db, { capacity: 10, startsAt: hours(70) });
    expect((await bookingOptions(h.db, u.id, s, 1, NOW)).map((o) => o.method)).toEqual(expect.arrayContaining(["membership", "pass", "free", "credits", "drop_in"]));
  });
});

describe("migration 0152: Zumba pro Soničku", () => {
  const ID = "9ed16f85-b076-4f4c-957f-10cb52da3726";
  // just the class update – the columns are there already
  const update = () => readFileSync("drizzle/0152_session_drop_in_only.sql", "utf8").split("--> statement-breakpoint").at(-1)!;
  const row = async () => (await h.db.select().from(classSessions).where(eq(classSessions.id, ID)))[0];

  it("turns the Sunday 6. 12. 18:00 Zumba into the charity class, once", async () => {
    await makeSession(h.db, { id: ID, startsAt: new Date("2026-12-06T17:00:00Z"), capacity: 14, creditCost: 220, dropInPrice: 25000 });
    await h.db.execute(sql.raw(update()));
    const s = await row();
    expect(s).toMatchObject({ title: "Zumba pro Soničku", dropInPrice: 15000, dropInOnly: true, ribbon: true, noFreeEntry: true, capacity: 14, bookingOpensAt: null });
    expect(s.note).toMatch(/^Benefiční lekce pro Soničku/);

    // what the studio changes afterwards stays
    await h.db.update(classSessions).set({ title: "Zumba pro Soňu", dropInPrice: 20000 }).where(eq(classSessions.id, ID));
    await h.db.execute(sql.raw(update()));
    expect(await row()).toMatchObject({ title: "Zumba pro Soňu", dropInPrice: 20000 });
  });

  it("0153 rewrites the note in the studio's words, only while it's the one 0152 wrote", async () => {
    const note = () => readFileSync("drizzle/0153_sonicka_note.sql", "utf8");
    const first = readFileSync("drizzle/0152_session_drop_in_only.sql", "utf8").match(/"note" = '([^']+)'/)![1];
    await h.db.update(classSessions).set({ note: first }).where(eq(classSessions.id, ID));
    await h.db.execute(sql.raw(note()));
    expect((await row()).note).toMatch(/^Benefiční lekce pro Soničku – krásnou slovenskou instruktorku Zumby, která vždycky inspirovala/);
    expect((await row()).note).toContain("Teď jí chceme udělat radost my");

    await h.db.update(classSessions).set({ note: "Vlastní poznámka" }).where(eq(classSessions.id, ID));
    await h.db.execute(sql.raw(note()));
    expect((await row()).note).toBe("Vlastní poznámka");
  });
});
