import { readFileSync } from "node:fs";
import { eq, sql } from "drizzle-orm";
import { PDFDocument } from "pdf-lib";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { classTypes, entitlements, passCardUses, passCards } from "@/db/schema";
import { bookSession, bookingOptions } from "@/domain/booking";
import {
  CARD_ENTRY_DAYS,
  CARD_ENTRY_NAME,
  CARD_VALID_DAYS,
  addPassCard,
  chargePassCard,
  comeAlone,
  listPassCards,
  markBookingAnnounced,
  markSignUpAnnounced,
  myPassCard,
  passCardByCode,
  passCardActivity,
  passCardOf,
  passCardStatsFrom,
  passOnUnused,
  recordPassCardScan,
  renewPassCard,
  resetPassCard,
  resetPassCardStats,
  setPassCardActive,
  startPassCardClock,
  unannouncedBookings,
  unannouncedExpiries,
  unannouncedSignUps,
} from "@/domain/pass-cards";
import { registerUser } from "@/domain/users";
import { CARDS_PER_SHEET, passCardsPdf, passCardsSheetPdf } from "@/lib/pass-card-pdf";
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

describe("Pošli to dál – a plastic card with two places that goes on right after the sign-ups", () => {
  it("the migration puts four cards with two places each into the game, and only once", async () => {
    await h.db.execute(sql.raw(readFileSync("drizzle/0094_pass_cards_seed.sql", "utf8")));
    const cards = await h.db.select().from(passCards);
    expect(cards.map((c) => c.label).sort()).toEqual(["Kartička 1", "Kartička 2", "Kartička 3", "Kartička 4"]);
    expect(cards.every((c) => /^[0-9A-F]{6}$/.test(c.code) && c.isActive && c.placesLeft === 2)).toBe(true);
  });

  it("two newcomers take the two places, each with a two-week lesson instead of the welcome one; then the card goes on at once", async () => {
    const c = await addPassCard(h.db);
    const jana = await signUp("Jana Nováková", c.code.toLowerCase());
    const [free] = await mine(jana.id);
    expect([free.name, free.entriesTotal]).toEqual([CARD_ENTRY_NAME, 1]);
    expect(free.validUntil.getTime() - NOW.getTime()).toBe(CARD_ENTRY_DAYS * 86_400_000);
    expect(await card(c.id)).toMatchObject({ placesLeft: 1, holderId: jana.id });
    expect(await passCardByCode(h.db, c.code)).toMatchObject({ placesLeft: 1, people: 1 });
    expect(await myPassCard(h.db, jana.id)).toMatchObject({ id: c.id, open: true, canComeAlone: true, placesLeft: 1 });

    // the friend takes the second place – the round is over, both places are back for the next one
    const petra = await signUp("Petra Malá", c.code, hours(0.5));
    expect((await mine(petra.id)).map((e) => e.name)).toEqual([CARD_ENTRY_NAME]);
    expect(await passCardOf(h.db, petra.id)).toMatchObject({ fromName: "Jana Nováková" });
    expect(await card(c.id)).toMatchObject({ placesLeft: 2, holderId: petra.id });
    expect(await myPassCard(h.db, jana.id)).toMatchObject({ open: false, canComeAlone: false, placesLeft: 2 });
    expect(await myPassCard(h.db, petra.id)).toMatchObject({ open: false, canComeAlone: false, placesLeft: 2 });

    // whoever has it passes it on – the next newcomer starts a new round
    const eva = await signUp("Eva Třetí", c.code, hours(1));
    expect((await mine(eva.id)).map((e) => e.name)).toEqual([CARD_ENTRY_NAME]);
    expect(await card(c.id)).toMatchObject({ placesLeft: 1, holderId: eva.id });
    expect(await myPassCard(h.db, jana.id)).toBeNull();
    expect(await myPassCard(h.db, eva.id)).toMatchObject({ open: true, canComeAlone: true });
  });

  it("„Přijdu sama“: the friend's place goes to the next one, and only the holder can let it go", async () => {
    const c = await addPassCard(h.db);
    const alone = await signUp("Alena Sama", c.code);
    const other = await signUp("Olga Jinde");
    expect(await comeAlone(h.db, other.id)).toBe(false);
    expect(await comeAlone(h.db, alone.id, hours(1))).toBe(true);
    expect(await card(c.id)).toMatchObject({ placesLeft: 2 });
    expect(await myPassCard(h.db, alone.id)).toMatchObject({ open: false, canComeAlone: false, placesLeft: 2 });
    expect(await comeAlone(h.db, alone.id)).toBe(false); // nothing left to let go
    // her free lesson stays hers
    expect((await mine(alone.id)).map((e) => [e.name, e.status])).toEqual([[CARD_ENTRY_NAME, "active"]]);
    const next = await signUp("Nela Další", c.code, hours(2));
    expect(await passCardOf(h.db, next.id)).toMatchObject({ fromName: "Alena Sama" });
    expect(await card(c.id)).toMatchObject({ placesLeft: 1 });
  });

  it("waiting cards from before get both places back (migration)", async () => {
    const c = await addPassCard(h.db);
    const a = await signUp("Lada Čekající", c.code);
    await h.db.update(passCards).set({ placesLeft: 0 }).where(eq(passCards.id, c.id));
    for (const stmt of readFileSync("drizzle/0098_pass_cards_round_over.sql", "utf8").split("--> statement-breakpoint"))
      await h.db.execute(sql.raw(stmt));
    expect(await card(c.id)).toMatchObject({ placesLeft: 2 });
    expect(await myPassCard(h.db, a.id)).toMatchObject({ open: false, placesLeft: 2 });
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

  it("the studio hears about sign-ups (and whether the card went on) and about lessons booked with it", async () => {
    for (const r of await unannouncedSignUps(h.db)) await markSignUpAnnounced(h.db, r.use.id, NOW);
    for (const r of await unannouncedBookings(h.db)) await markBookingAnnounced(h.db, r.use.id, NOW);
    const c = await addPassCard(h.db);
    const a = await signUp("Alena Dvořáková", c.code);
    expect((await unannouncedSignUps(h.db)).map((r) => [r.userName, !!r.use.rechargedAt])).toEqual([["Alena Dvořáková", false]]);
    const b = await signUp("Bára Dvořáková", c.code, hours(1));
    expect((await unannouncedSignUps(h.db)).map((r) => [r.userName, !!r.use.rechargedAt])).toEqual([
      ["Alena Dvořáková", true],
      ["Bára Dvořáková", true],
    ]);

    const s = await makeSession(h.db, { capacity: 10, startsAt: hours(48) });
    await book(a.id, s.id, (await mine(a.id))[0].id);
    await book(b.id, s.id, (await mine(b.id))[0].id);
    const booked = await unannouncedBookings(h.db);
    expect(booked.map((r) => r.userName).sort()).toEqual(["Alena Dvořáková", "Bára Dvořáková"]);
    for (const r of booked) await markBookingAnnounced(h.db, r.use.id, NOW);
    expect(await unannouncedBookings(h.db)).toHaveLength(0);

    const listed = (await listPassCards(h.db)).find((x) => x.id === c.id)!;
    expect(listed.chain.map((u) => [u.name, !!u.lesson, !!u.rechargedAt, !!u.validUntil])).toEqual([
      ["Alena Dvořáková", true, true, true],
      ["Bára Dvořáková", true, true, true],
    ]);
  });

  it("the card's lesson counts on Reformer (a class marked for it), where the welcome lesson doesn't", async () => {
    const c = await addPassCard(h.db);
    const withCard = await signUp("Reformer Nováčková", c.code);
    const welcome = await signUp("Uvítací Klientka");
    const reformer = await makeSession(h.db, { capacity: 10, startsAt: hours(30) });
    await h.db.update(classTypes).set({ name: "Reformer fusion", noFreeEntry: true, passCardEntry: true }).where(eq(classTypes.id, reformer.classTypeId));
    const brunch = await makeSession(h.db, { capacity: 10, startsAt: hours(32) });
    await h.db.update(classTypes).set({ name: "Fitness brunch", noFreeEntry: true }).where(eq(classTypes.id, brunch.classTypeId));
    const free = async (userId: string, s: typeof reformer) =>
      (await h.db.transaction((tx) => bookingOptions(tx, userId, s))).find((o) => o.method === "free")!;

    expect((await free(withCard.id, reformer)).disabled).toBeUndefined();
    expect((await free(welcome.id, reformer)).disabled).toMatch(/nejde/);
    expect((await free(withCard.id, brunch)).disabled).toMatch(/nejde/); // only where the class lets the card in

    await book(withCard.id, reformer.id, (await mine(withCard.id))[0].id);
    await expect(book(welcome.id, reformer.id, (await mine(welcome.id))[0].id)).rejects.toThrow(/nejde/);
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

  it("a card left unused for a month expires – the studio hears about it and can renew it", async () => {
    const days = (n: number) => hours(24 * n);
    const c = await addPassCard(h.db);
    // printed and handed out: its month starts with the first scan, not before
    expect((await card(c.id)).validUntil).toBeNull();
    const until = await startPassCardClock(h.db, c.id, NOW);
    expect(until!.getTime() - NOW.getTime()).toBe(CARD_VALID_DAYS * 86_400_000);
    expect(await startPassCardClock(h.db, c.id, days(5))).toBeNull(); // already running

    // a sign-up gives the card another month
    const a = await signUp("Adéla Včasná", c.code, days(20));
    expect((await card(c.id)).validUntil!.getTime()).toBe(days(20 + CARD_VALID_DAYS).getTime());
    expect(await passCardByCode(h.db, c.code, days(49))).toMatchObject({ expired: false });

    // nobody for a month: the card is out, a late scan gets the ordinary welcome lesson
    const late = days(20 + CARD_VALID_DAYS + 1);
    expect(await passCardByCode(h.db, c.code, late)).toMatchObject({ expired: true });
    expect(await comeAlone(h.db, a.id, late)).toBe(false);
    expect(await myPassCard(h.db, a.id, late)).toMatchObject({ expired: true, canComeAlone: false });
    const b = await signUp("Bára Pozdní", c.code, late);
    expect((await mine(b.id)).map((e) => e.name)).toEqual(["Úvodní lekce zdarma"]);
    expect((await unannouncedExpiries(h.db, late)).map((x) => x.label)).toContain(c.label);

    // renewed: the next scan starts a new month and the card works again
    await renewPassCard(h.db, c.id);
    expect(await passCardByCode(h.db, c.code, late)).toMatchObject({ expired: false, validUntil: null });
    expect((await unannouncedExpiries(h.db, late)).map((x) => x.label)).not.toContain(c.label);
    const d = await signUp("Dana Obnovená", c.code, late);
    expect((await mine(d.id)).map((e) => e.name)).toEqual([CARD_ENTRY_NAME]);
  });

  it("a card out of the game or a made-up code is an ordinary sign-up; the studio can charge a card by hand", async () => {
    const c = await addPassCard(h.db);
    await setPassCardActive(h.db, c.id, false);
    const a = await signUp("Alena Mimo", c.code);
    const b = await signUp("Bára Vymyšlená", "ZZZZZZ");
    expect([(await mine(a.id))[0].name, (await mine(b.id))[0].name]).toEqual(["Úvodní lekce zdarma", "Úvodní lekce zdarma"]);

    const d = await addPassCard(h.db);
    const dana = await signUp("Dana Ruční", d.code);
    await chargePassCard(h.db, d.id, NOW);
    expect(await card(d.id)).toMatchObject({ placesLeft: 2 });
    expect(await myPassCard(h.db, dana.id)).toMatchObject({ open: false, canComeAlone: false });
  });

  it("a reset brings any card back – in the game, both places, its month from the next scan – and keeps its chain", async () => {
    const c = await addPassCard(h.db);
    const rita = await signUp("Rita Resetová", c.code);
    // stuck every way at once: a place still waiting for the friend, expired, the studio told, and out of the game
    await h.db.update(passCards).set({ validUntil: hours(-24), expiredNotifiedAt: NOW }).where(eq(passCards.id, c.id));
    await setPassCardActive(h.db, c.id, false);
    expect(await card(c.id)).toMatchObject({ isActive: false, placesLeft: 1 });

    await resetPassCard(h.db, c.id, NOW);
    expect(await card(c.id)).toMatchObject({ isActive: true, placesLeft: 2, validUntil: null, expiredNotifiedAt: null });
    expect(await myPassCard(h.db, rita.id)).toMatchObject({ open: false, canComeAlone: false });
    expect((await listPassCards(h.db)).find((x) => x.id === c.id)!.chain.map((u) => u.name)).toEqual(["Rita Resetová"]);

    // and it works again: the next one gets the card's lesson and takes a place
    const bea = await signUp("Bea Poresetová", c.code);
    expect((await mine(bea.id)).map((e) => e.name)).toEqual([CARD_ENTRY_NAME]);
    expect(await card(c.id)).toMatchObject({ placesLeft: 1 });
  });

  it("the studio sees the scans of any card that exists, with the sign-ups, newest first – and how often each card was scanned", async () => {
    const c = await addPassCard(h.db);
    expect(await recordPassCardScan(h.db, "nope", null)).toBe(false);
    expect(await recordPassCardScan(h.db, "000000", null)).toBe(false); // no such card
    expect(await recordPassCardScan(h.db, c.code.toLowerCase(), null, hours(1))).toBe(true);
    const eva = await signUp("Eva Skenovaná", c.code, hours(2));
    expect(await recordPassCardScan(h.db, c.code, eva.id, hours(3))).toBe(true);
    await setPassCardActive(h.db, c.id, false);
    expect(await recordPassCardScan(h.db, c.code, null, hours(4))).toBe(true); // out of the game – still worth knowing

    const { scans, signUps } = await passCardActivity(h.db, NOW);
    expect(scans.filter((x) => x.label === c.label).map((x) => [x.at.getTime(), x.name])).toEqual([
      [hours(4).getTime(), null],
      [hours(3).getTime(), "Eva Skenovaná"],
      [hours(1).getTime(), null],
    ]);
    expect(signUps.filter((x) => x.label === c.label).map((x) => x.name)).toEqual(["Eva Skenovaná"]);
    expect((await passCardActivity(h.db, hours(5))).scans).toEqual([]);
    expect((await listPassCards(h.db)).find((x) => x.id === c.id)!.scans).toMatchObject({ n: 3, last: hours(4) });

    // „Vynulovat“: the counts start again, the history stays
    await resetPassCardStats(h.db, hours(5));
    expect(await passCardStatsFrom(h.db)).toEqual(hours(5));
    expect((await listPassCards(h.db, await passCardStatsFrom(h.db))).find((x) => x.id === c.id)!.scans).toMatchObject({ n: 0, last: null });
    await recordPassCardScan(h.db, c.code, null, hours(6));
    expect((await listPassCards(h.db, hours(5))).find((x) => x.id === c.id)!.scans).toMatchObject({ n: 1, last: hours(6) });
    expect((await listPassCards(h.db)).find((x) => x.id === c.id)!.scans).toMatchObject({ n: 4 });
  });

  it("„Nezajímá mě – pošlu kartičku dál“ sends the card on with both places – the place left over goes too", async () => {
    const c = await addPassCard(h.db);
    expect(await passOnUnused(h.db, c.code)).toBe(false); // both places there – nothing to do
    const ivana = await signUp("Ivana První", c.code);
    expect(await card(c.id)).toMatchObject({ placesLeft: 1 });
    const until = (await card(c.id)).validUntil;

    expect(await passOnUnused(h.db, c.code.toLowerCase(), NOW)).toBe(true);
    expect(await card(c.id)).toMatchObject({ placesLeft: 2, validUntil: until }); // its month stays
    expect(await myPassCard(h.db, ivana.id)).toMatchObject({ open: false, canComeAlone: false });
    const next = await signUp("Nela Další", c.code);
    expect((await mine(next.id)).map((e) => e.name)).toEqual([CARD_ENTRY_NAME]);
    expect(await card(c.id)).toMatchObject({ placesLeft: 1 });

    // an expired card or one out of the game stays as it is
    await h.db.update(passCards).set({ validUntil: hours(-1) }).where(eq(passCards.id, c.id));
    expect(await passOnUnused(h.db, c.code, NOW)).toBe(false);
    await h.db.update(passCards).set({ validUntil: null, isActive: false }).where(eq(passCards.id, c.id));
    expect(await passOnUnused(h.db, c.code, NOW)).toBe(false);
    expect(await passOnUnused(h.db, "000000", NOW)).toBe(false);
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

  it("prints them on A4 for duplex printing: a page of fronts and a page of backs per 10 cards", async () => {
    const cards = Array.from({ length: CARDS_PER_SHEET + 2 }, (_, i) => ({ label: `Kartička ${i + 1}`, code: `C${i}`, url: `https://www.octopush.fit/karticka/C${i}` }));
    const doc = await PDFDocument.load(await passCardsSheetPdf(cards, "OCTOPUSH · Pospolitá 699/16, Ostrava"));
    expect(doc.getPageCount()).toBe(4);
    // the printer's shift made up for on the backs – the same pages
    const shifted = await PDFDocument.load(await passCardsSheetPdf(cards, "OCTOPUSH · Pospolitá 699/16, Ostrava", { backShiftMm: 3 }));
    expect(shifted.getPageCount()).toBe(4);
    const { width, height } = doc.getPage(0).getSize();
    expect(width).toBeCloseTo((210 * 72) / 25.4, 1);
    expect(height).toBeCloseTo((297 * 72) / 25.4, 1);
  });
});
