import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { entitlements, passCardUses, passCards } from "@/db/schema";
import { bookSession, bookingOptions } from "@/domain/booking";
import {
  CARD_ENTRY_NAME,
  addPassCard,
  chargePassCard,
  dueRecharges,
  listPassCards,
  markBookingAnnounced,
  markSignUpAnnounced,
  myPassCard,
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
const book = (userId: string, sessionId: string, entitlementId: string, guestName?: string) =>
  bookSession(h.db, { userId, sessionId, method: "free", entitlementId, guestName }, NOW);

describe("Pošli to dál – a plastic card with two places that charges itself again", () => {
  it("the migration puts four cards with two places each into the game, and only once", async () => {
    await h.db.execute(sql.raw(readFileSync("drizzle/0094_pass_cards_seed.sql", "utf8")));
    const cards = await h.db.select().from(passCards);
    expect(cards.map((c) => c.label).sort()).toEqual(["Kartička 1", "Kartička 2", "Kartička 3", "Kartička 4"]);
    expect(cards.every((c) => /^[0-9A-F]{6}$/.test(c.code) && c.isActive && c.placesLeft === 2)).toBe(true);
  });

  it("two newcomers take the two places, each with a lesson of her own instead of the welcome one; then it's empty", async () => {
    const c = await addPassCard(h.db);
    const jana = await signUp("Jana Nováková", c.code.toLowerCase());
    expect((await mine(jana.id)).map((e) => [e.name, e.entriesTotal])).toEqual([[CARD_ENTRY_NAME, 1]]);
    expect(await card(c.id)).toMatchObject({ placesLeft: 1, holderId: jana.id });
    expect(await passCardByCode(h.db, c.code)).toMatchObject({ placesLeft: 1, people: 1 });
    expect(await myPassCard(h.db, jana.id)).toMatchObject({ id: c.id, open: true, placesLeft: 1 });

    const petra = await signUp("Petra Malá", c.code);
    expect((await mine(petra.id)).map((e) => e.name)).toEqual([CARD_ENTRY_NAME]);
    expect(await passCardOf(h.db, petra.id)).toMatchObject({ fromName: "Jana Nováková" });
    expect(await card(c.id)).toMatchObject({ placesLeft: 0 });

    // a photo of the QR code passed around gets nobody anything more
    const eva = await signUp("Eva Třetí", c.code);
    expect((await mine(eva.id)).map((e) => [e.name, e.entriesTotal])).toEqual([["Úvodní lekce zdarma", 1]]);
    expect(await passCardOf(h.db, eva.id)).toBeNull();
  });

  it("at payment only those who came with the card see it – never an existing client", async () => {
    const c = await addPassCard(h.db);
    const newcomer = await signUp("Nová Klientka", c.code);
    const regular = await signUp("Stálá Klientka");
    const s = await makeSession(h.db, { capacity: 10, startsAt: hours(40) });
    const labels = async (userId: string) => (await h.db.transaction((tx) => bookingOptions(tx, userId, s))).map((o) => o.label);
    expect(await labels(newcomer.id)).toContain(CARD_ENTRY_NAME);
    expect(await labels(regular.id)).not.toContain(CARD_ENTRY_NAME);
  });

  it("the studio hears about sign-ups and bookings; after both lessons the card has two places again", async () => {
    for (const r of await unannouncedSignUps(h.db)) await markSignUpAnnounced(h.db, r.use.id, NOW);
    const c = await addPassCard(h.db);
    const a = await signUp("Alena Dvořáková", c.code);
    const b = await signUp("Bára Dvořáková", c.code);
    expect((await unannouncedSignUps(h.db)).map((r) => [r.userName, r.placesLeft])).toEqual([
      ["Alena Dvořáková", 0],
      ["Bára Dvořáková", 0],
    ]);

    const s = await makeSession(h.db, { capacity: 10, startsAt: hours(48) });
    await book(a.id, s.id, (await mine(a.id))[0].id);
    await book(b.id, s.id, (await mine(b.id))[0].id);
    const booked = await unannouncedBookings(h.db);
    expect(booked.map((r) => r.userName).sort()).toEqual(["Alena Dvořáková", "Bára Dvořáková"]);
    for (const r of booked) await markBookingAnnounced(h.db, r.use.id, NOW);

    expect((await dueRecharges(h.db, hours(48.5))).filter((r) => r.cardId === c.id)).toHaveLength(0); // still in the lesson
    const [due] = (await dueRecharges(h.db, hours(49.1))).filter((r) => r.cardId === c.id);
    expect(due.uses.map((u) => [u.userName, u.outcome])).toEqual([
      ["Alena Dvořáková", "came"],
      ["Bára Dvořáková", "came"],
    ]);
    expect(await recharge(h.db, due, hours(49.1))).toBe(true);
    expect(await recharge(h.db, due, hours(49.2))).toBe(false);
    expect(await card(c.id)).toMatchObject({ placesLeft: 2 });
    // both may pass it on…
    expect(await myPassCard(h.db, a.id)).toMatchObject({ open: false, placesLeft: 2 });
    expect(await myPassCard(h.db, b.id)).toMatchObject({ open: false, placesLeft: 2 });

    // …until somebody new signs up with it
    const ola = await signUp("Ola Další", c.code, hours(50));
    expect(await myPassCard(h.db, a.id)).toBeNull();
    expect(await myPassCard(h.db, ola.id)).toMatchObject({ open: true, placesLeft: 1 });
    const listed = (await listPassCards(h.db)).find((x) => x.id === c.id)!;
    expect(listed.chain.map((u) => [u.name, !!u.lesson, !!u.rechargedAt])).toEqual([
      ["Alena Dvořáková", true, true],
      ["Bára Dvořáková", true, true],
      ["Ola Další", false, false],
    ]);
  });

  it("when the second one never books, the card charges once her entry has run out", async () => {
    const c = await addPassCard(h.db);
    const a = await signUp("Cecílie Prvá", c.code);
    const b = await signUp("Dita Druhá", c.code);
    const s = await makeSession(h.db, { capacity: 10, startsAt: hours(30) });
    await book(a.id, s.id, (await mine(a.id))[0].id);
    expect((await dueRecharges(h.db, hours(32))).filter((r) => r.cardId === c.id)).toHaveLength(0);
    const later = new Date((await mine(b.id))[0].validUntil.getTime() + 60_000);
    const [due] = (await dueRecharges(h.db, later)).filter((r) => r.cardId === c.id);
    expect(due.uses.map((u) => u.outcome)).toEqual(["came", "unused"]);
  });

  it("in the account it's one lesson only – no second booking, no friend (+1) on it, nobody on a card twice", async () => {
    const c = await addPassCard(h.db);
    const u = await signUp("Hana Jednou", c.code);
    const [free] = await mine(u.id);
    const s1 = await makeSession(h.db, { capacity: 10, startsAt: hours(26) });
    const s2 = await makeSession(h.db, { capacity: 10, startsAt: hours(28) });
    await expect(book(u.id, s1.id, free.id, "Petra")).rejects.toThrow("potřebuješ 2 vstupy"); // the friend signs up herself
    await book(u.id, s1.id, free.id);
    await expect(book(u.id, s2.id, free.id)).rejects.toThrow("Vyčerpané vstupy");
    await expect(h.db.insert(passCardUses).values({ cardId: c.id, userId: u.id })).rejects.toThrow();
  });

  it("a card out of the game or a made-up code is an ordinary sign-up; the studio can charge a card by hand", async () => {
    const c = await addPassCard(h.db);
    await setPassCardActive(h.db, c.id, false);
    const a = await signUp("Alena Mimo", c.code);
    const b = await signUp("Bára Vymyšlená", "ZZZZZZ");
    expect([(await mine(a.id))[0].name, (await mine(b.id))[0].name]).toEqual(["Úvodní lekce zdarma", "Úvodní lekce zdarma"]);

    const d = await addPassCard(h.db);
    await signUp("Dana Ruční", d.code);
    await signUp("Ema Ruční", d.code);
    await chargePassCard(h.db, d.id, NOW);
    expect(await card(d.id)).toMatchObject({ placesLeft: 2 });
    expect((await dueRecharges(h.db, hours(24 * 60))).filter((r) => r.cardId === d.id)).toHaveLength(0);
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
