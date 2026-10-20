import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { bookings, entitlements, passCards } from "@/db/schema";
import { bookSession, cancelBooking } from "@/domain/booking";
import {
  PAIR_NAME,
  addPassCard,
  cardHeldBy,
  chargePassCard,
  dueRecharges,
  listPassCards,
  markBookingAnnounced,
  markSignUpAnnounced,
  passCardByCode,
  passCardOf,
  recharge,
  setPassCardActive,
  unannouncedBookings,
  unannouncedSignUps,
} from "@/domain/pass-cards";
import { registerUser } from "@/domain/users";
import { passCardsPdf } from "@/lib/pass-card-pdf";
import { NOW, hours, makeSession, testDb } from "./helpers";

let h: Awaited<ReturnType<typeof testDb>>;
beforeAll(async () => {
  h = await testDb();
});
afterAll(async () => h.close());

let n = 0;
const signUp = (name: string, passCard?: string, at = NOW) =>
  registerUser(h.db, { email: `card${++n}@test.cz`, name, passwordHash: "x", passCard }, at);
const mine = (userId: string) => h.db.select().from(entitlements).where(eq(entitlements.userId, userId));
const card = async (id: string) => (await h.db.select().from(passCards).where(eq(passCards.id, id)))[0];

describe("Pošli to dál – a plastic card that charges itself again", () => {
  it("the migration puts four charged cards into the game, and only once", async () => {
    await h.db.execute(sql.raw(readFileSync("drizzle/0094_pass_cards_seed.sql", "utf8")));
    const cards = await h.db.select().from(passCards);
    expect(cards.map((c) => c.label).sort()).toEqual(["Kartička 1", "Kartička 2", "Kartička 3", "Kartička 4"]);
    expect(cards.every((c) => /^[0-9A-F]{6}$/.test(c.code) && c.isActive && c.charged && !c.holderId)).toBe(true);
  });

  it("a charged card gives one lesson for two instead of the welcome one, and empties itself", async () => {
    const c = await addPassCard(h.db);
    const jana = await signUp("Jana Nováková", c.code.toLowerCase());
    const ents = await mine(jana.id);
    expect(ents).toHaveLength(1); // no extra welcome lesson
    expect(ents[0]).toMatchObject({ kind: "free", name: PAIR_NAME, entriesTotal: 2, pair: true });
    expect(await card(c.id)).toMatchObject({ charged: false, holderId: jana.id });
    expect(await cardHeldBy(h.db, jana.id)).toMatchObject({ id: c.id, charged: false, people: 1 });
    expect(await passCardByCode(h.db, c.code)).toMatchObject({ holder: "Jana", charged: false, people: 1 });

    // a photo of the QR code passed around gets nobody anything until the lesson is over
    const eva = await signUp("Eva Malá", c.code);
    expect((await mine(eva.id)).map((e) => [e.name, e.entriesTotal])).toEqual([["Úvodní lekce zdarma", 1]]);
    expect(await passCardOf(h.db, eva.id)).toBeNull();
    expect(await card(c.id)).toMatchObject({ holderId: jana.id });
  });

  it("the studio hears about the sign-up and the booking; after the lesson the card charges and passes on", async () => {
    const c = await addPassCard(h.db);
    const jana = await signUp("Jana Dvořáková", c.code);
    const [pair] = await mine(jana.id);
    expect((await unannouncedSignUps(h.db)).map((r) => r.userName)).toContain("Jana Dvořáková");
    for (const r of await unannouncedSignUps(h.db)) await markSignUpAnnounced(h.db, r.use.id, NOW);
    expect(await unannouncedSignUps(h.db)).toHaveLength(0);

    const s = await makeSession(h.db, { capacity: 10, startsAt: hours(48) });
    const { booking } = await bookSession(h.db, { userId: jana.id, sessionId: s.id, method: "free", entitlementId: pair.id, guestName: "Petra" }, NOW);
    // one lesson for two – both seats from the one entry
    expect((await h.db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]).toMatchObject({ seats: 2, entriesCharged: 2 });
    const booked = await unannouncedBookings(h.db);
    expect(booked.map((r) => [r.userName, r.lesson.guestName])).toEqual([["Jana Dvořáková", "Petra"]]);
    await markBookingAnnounced(h.db, booked[0].use.id, NOW);

    expect(await dueRecharges(h.db, hours(48.5))).toHaveLength(0); // the lesson is still on
    const due = await dueRecharges(h.db, hours(49.1));
    expect(due.map((r) => [r.userName, r.outcome])).toEqual([["Jana Dvořáková", "came"]]);
    expect(await recharge(h.db, due[0], hours(49.1))).toBe(true);
    expect(await recharge(h.db, due[0], hours(49.2))).toBe(false);
    expect(await card(c.id)).toMatchObject({ charged: true, holderId: jana.id });

    // the next newcomer gets it from Jana
    const ola = await signUp("Ola Třetí", c.code, hours(50));
    expect((await mine(ola.id))[0]).toMatchObject({ pair: true });
    expect(await passCardOf(h.db, ola.id)).toMatchObject({ fromName: "Jana Dvořáková" });
    const listed = (await listPassCards(h.db)).find((x) => x.id === c.id)!;
    expect(listed.chain.map((u) => [u.name, u.lesson?.guestName ?? null, !!u.rechargedAt])).toEqual([
      ["Jana Dvořáková", "Petra", true],
      ["Ola Třetí", null, false],
    ]);
  });

  it("alone it's still the one lesson; unused (or cancelled and never rebooked) the card charges when the entry runs out", async () => {
    const c = await addPassCard(h.db);
    const alone = await signUp("Sama Jedna", c.code);
    const [pair] = await mine(alone.id);
    const s = await makeSession(h.db, { capacity: 10, startsAt: hours(30) });
    const { booking } = await bookSession(h.db, { userId: alone.id, sessionId: s.id, method: "free", entitlementId: pair.id }, NOW);
    expect((await h.db.select().from(bookings).where(eq(bookings.id, booking.id)))[0]).toMatchObject({ seats: 1, entriesCharged: 2 });
    await cancelBooking(h.db, { bookingId: booking.id, actorId: alone.id }, NOW);
    expect((await mine(alone.id))[0].entriesUsed).toBe(0);

    expect((await dueRecharges(h.db, hours(31))).filter((r) => r.use.userId === alone.id)).toHaveLength(0);
    const later = new Date(pair.validUntil.getTime() + 60_000);
    const due = (await dueRecharges(h.db, later)).filter((r) => r.use.userId === alone.id);
    expect(due.map((r) => r.outcome)).toEqual(["unused"]);
  });

  it("a card out of the game or a made-up code is an ordinary sign-up; the studio can charge a card by hand", async () => {
    const c = await addPassCard(h.db);
    await setPassCardActive(h.db, c.id, false);
    const a = await signUp("Alena Prvá", c.code);
    const b = await signUp("Bára Druhá", "ZZZZZZ");
    expect([(await mine(a.id))[0].name, (await mine(b.id))[0].name]).toEqual(["Úvodní lekce zdarma", "Úvodní lekce zdarma"]);

    const d = await addPassCard(h.db);
    await signUp("Dana Čtvrtá", d.code);
    await chargePassCard(h.db, d.id, NOW);
    expect(await card(d.id)).toMatchObject({ charged: true });
    expect((await dueRecharges(h.db, hours(24 * 60))).filter((r) => r.use.cardId === d.id)).toHaveLength(0);
  });

  it("prints front and back of every card in the payment-card size", async () => {
    const bytes = await passCardsPdf(
      [
        { label: "Kartička 1", code: "7F3A9C", url: "https://www.octopush.fit/karticka/7F3A9C" },
        { label: "Kartička 2", code: "0B12EE", url: "https://www.octopush.fit/karticka/0B12EE" },
      ],
      "OCTOPUSH · Pospolitá 699/16, Ostrava",
    );
    const doc = await PDFDocument.load(bytes);
    expect(doc.getPageCount()).toBe(4);
    // 85.6 × 54 mm with 3 mm bleed
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo((91.6 * 72) / 25.4, 1);
    expect(height).toBeCloseTo((60 * 72) / 25.4, 1);
  });
});
