import { randomBytes } from "node:crypto";
import { and, asc, count, desc, eq, gte, inArray, isNull, max, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/db";
import { bookings, classSessions, classTypes, entitlements, passCardScans, passCardUses, passCards, users } from "@/db/schema";
import { sessionNameSql } from "@/lib/session-name";

/**
 * Pošli to dál: plastic cards with a QR code that travel from person to person.
 * A charged card has two places, one for each new client who signs up with it –
 * a newcomer and the friend she brings (who scans it too, or gets the link from
 * her account). Each gets one lesson free instead of the welcome lesson, valid
 * for two weeks, and pays for it at booking with „Kartička Pošli to dál“ –
 * existing clients never see it. Once both places are taken – or the first one
 * says she comes alone – the round is over: the card has two places again and
 * goes on right away, no waiting for the lessons. A card left lying around
 * expires: it has to be used within a month of its last use (a new one, of its
 * first scan), else it's out until the studio renews it.
 */

export const CARD_PLACES = 2;
export const CARD_ENTRY_NAME = "Kartička Pošli to dál – lekce zdarma 💛";
/** How long the card's free lesson can be booked, from the sign-up. */
export const CARD_ENTRY_DAYS = 14;
/** How long a card may lie unused before it expires. */
export const CARD_VALID_DAYS = 30;
const DAY = 86_400_000;
const validFrom = (now: Date) => new Date(now.getTime() + CARD_VALID_DAYS * DAY);
const expired = (card: { validUntil: Date | null }, now: Date) => !!card.validUntil && card.validUntil <= now;

export const isCardCode = (code: string) => /^[0-9A-F]{6}$/i.test(code.trim());
const norm = (code: string) => code.trim().toUpperCase();

/** The card behind a QR code, for its landing page and the sign-up. */
export async function passCardByCode(db: Executor, code: string, now = new Date()) {
  if (!isCardCode(code)) return null;
  const [card] = await db.select().from(passCards).where(eq(passCards.code, norm(code)));
  if (!card) return null;
  const [{ n }] = await db.select({ n: count() }).from(passCardUses).where(eq(passCardUses.cardId, card.id));
  return {
    id: card.id,
    code: card.code,
    label: card.label,
    isActive: card.isActive,
    expired: expired(card, now),
    validUntil: card.validUntil,
    placesLeft: card.placesLeft,
    people: n,
  };
}

/** A new card's month starts when someone first scans it (not when it's printed). */
export async function startPassCardClock(db: Executor, id: string, now = new Date()) {
  const [card] = await db
    .update(passCards)
    .set({ validUntil: validFrom(now) })
    .where(and(eq(passCards.id, id), eq(passCards.isActive, true), isNull(passCards.validUntil)))
    .returning({ validUntil: passCards.validUntil });
  return card?.validUntil ?? null;
}

/**
 * A new client signed up with the card (inside the registration's transaction):
 * she takes one of its places and is recorded as the one who came on it. The
 * second place closes the round and the card is charged again at once. Null for
 * an unknown, withdrawn or empty card – then it's an ordinary sign-up.
 */
export async function claimPassCard(tx: Executor, code: string, userId: string, now = new Date()) {
  if (!isCardCode(code)) return null;
  const [card] = await tx
    .select()
    .from(passCards)
    .where(and(eq(passCards.code, norm(code)), eq(passCards.isActive, true), sql`${passCards.placesLeft} > 0`))
    .for("update");
  if (!card || expired(card, now)) return null;
  const [use] = await tx.insert(passCardUses).values({ cardId: card.id, userId, fromUserId: card.holderId, createdAt: now }).returning();
  // a use gives the card another month
  await tx.update(passCards).set({ holderId: userId, placesLeft: card.placesLeft - 1, validUntil: validFrom(now) }).where(eq(passCards.id, card.id));
  const roundOver = card.placesLeft === 1;
  if (roundOver) await chargePassCard(tx, card.id, now);
  return { ...card, placesLeft: roundOver ? CARD_PLACES : card.placesLeft - 1, roundOver, useId: use.id };
}

/**
 * „Přijdu sama“: the one who holds the card with a place still free lets it go –
 * the card is charged again and the next one gets both places. False when it
 * isn't hers to let go (someone took the place meanwhile, or she isn't the holder).
 */
export async function comeAlone(db: Executor, userId: string, now = new Date()) {
  const [card] = await db
    .select({ id: passCards.id, validUntil: passCards.validUntil })
    .from(passCards)
    .innerJoin(passCardUses, and(eq(passCardUses.cardId, passCards.id), eq(passCardUses.userId, userId)))
    .where(and(eq(passCards.holderId, userId), eq(passCards.isActive, true), eq(passCards.placesLeft, CARD_PLACES - 1), isNull(passCardUses.rechargedAt)));
  if (!card || expired(card, now)) return false;
  await chargePassCard(db, card.id, now);
  await db.update(passCards).set({ validUntil: validFrom(now) }).where(eq(passCards.id, card.id));
  return true;
}

/**
 * „Nezajímá mě – pošlu kartičku dál“: whoever scanned the card won't use it. A place left over from an
 * open round goes too – the card is charged again, so the next one gets both places. Its month stays.
 * False when there was nothing to charge (both places there, out of the game, expired, no such card).
 */
export async function passOnUnused(db: Executor, code: string, now = new Date()) {
  if (!isCardCode(code)) return false;
  const [card] = await db
    .select()
    .from(passCards)
    .where(and(eq(passCards.code, norm(code)), eq(passCards.isActive, true)));
  if (!card || expired(card, now) || card.placesLeft >= CARD_PLACES) return false;
  await chargePassCard(db, card.id, now);
  return true;
}

/** The free lesson she got with the card (paid for at booking with „Kartička Pošli to dál“). */
export const linkPassEntitlement = (tx: Executor, useId: string, entitlementId: string) =>
  tx.update(passCardUses).set({ entitlementId }).where(eq(passCardUses.id, useId));

/**
 * The card the client came with, for Můj účet – while it's still about her: her
 * round is open (a place left for a friend), or it's over and nobody has signed
 * up with the card since.
 */
export async function myPassCard(db: Executor, userId: string, now = new Date()) {
  const [row] = await db
    .select({ use: passCardUses, card: passCards })
    .from(passCardUses)
    .innerJoin(passCards, eq(passCardUses.cardId, passCards.id))
    .where(and(eq(passCardUses.userId, userId), eq(passCards.isActive, true)));
  if (!row) return null;
  const open = !row.use.rechargedAt;
  if (!open) {
    // charged again after her round – still theirs to pass on until someone new signs up with it
    const since = await db
      .select({ id: passCardUses.id })
      .from(passCardUses)
      .where(and(eq(passCardUses.cardId, row.card.id), sql`${passCardUses.createdAt} > ${row.use.createdAt}`, sql`(${passCardUses.rechargedAt} is null or ${passCardUses.rechargedAt} > ${row.use.rechargedAt})`))
      .limit(1);
    if (since.length) return null;
  }
  const [{ n }] = await db.select({ n: count() }).from(passCardUses).where(eq(passCardUses.cardId, row.card.id));
  const isExpired = expired(row.card, now);
  // her place taken, the friend's still free – she may let it go („Přijdu sama“)
  const canComeAlone = open && !isExpired && row.card.holderId === userId && row.card.placesLeft === CARD_PLACES - 1;
  return { ...row.card, open, expired: isExpired, canComeAlone, people: n };
}

/** For the admin's client card: which card she came with and from whom. */
export async function passCardOf(db: Executor, userId: string) {
  const from = alias(users, "from_user");
  const [row] = await db
    .select({ label: passCards.label, fromId: from.id, fromName: from.name, at: passCardUses.createdAt })
    .from(passCardUses)
    .innerJoin(passCards, eq(passCardUses.cardId, passCards.id))
    .leftJoin(from, eq(passCardUses.fromUserId, from.id))
    .where(eq(passCardUses.userId, userId));
  return row ?? null;
}

/** Lessons booked with the cards' free entries – what happened with each use. */
async function cardBookings(db: Executor, entitlementIds: string[]) {
  if (!entitlementIds.length) return [];
  return db
    .select({
      entitlementId: bookings.entitlementId,
      bookingId: bookings.id,
      status: bookings.status,
      sessionId: classSessions.id,
      name: sessionNameSql,
      startsAt: classSessions.startsAt,
      endsAt: sql<Date>`${classSessions.startsAt} + make_interval(mins => ${classSessions.durationMin})`.mapWith(
        (v: string | Date) => new Date(v),
      ),
    })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(and(inArray(bookings.entitlementId, entitlementIds), inArray(bookings.status, ["confirmed", "attended", "no_show"])))
    .orderBy(asc(classSessions.startsAt));
}

/** Admin overview: every card, its places and the whole chain with what each one did. */
export async function listPassCards(db: Executor) {
  const cards = await db.select().from(passCards).orderBy(asc(passCards.createdAt), asc(passCards.label));
  const from = alias(users, "from_user");
  const uses = await db
    .select({
      id: passCardUses.id,
      cardId: passCardUses.cardId,
      at: passCardUses.createdAt,
      userId: users.id,
      name: users.name,
      fromName: from.name,
      entitlementId: passCardUses.entitlementId,
      validUntil: entitlements.validUntil,
      rechargedAt: passCardUses.rechargedAt,
    })
    .from(passCardUses)
    .innerJoin(users, eq(passCardUses.userId, users.id))
    .leftJoin(from, eq(passCardUses.fromUserId, from.id))
    .leftJoin(entitlements, eq(passCardUses.entitlementId, entitlements.id))
    .orderBy(asc(passCardUses.createdAt));
  const lessons = await cardBookings(db, uses.flatMap((u) => (u.entitlementId ? [u.entitlementId] : [])));
  const scans = await db.select({ cardId: passCardScans.cardId, n: count(), last: max(passCardScans.createdAt) }).from(passCardScans).groupBy(passCardScans.cardId);
  return cards.map((card) => ({
    ...card,
    scans: scans.find((x) => x.cardId === card.id) ?? { n: 0, last: null },
    chain: uses
      .filter((u) => u.cardId === card.id)
      .map((u) => ({ ...u, lesson: lessons.find((l) => l.entitlementId === u.entitlementId) ?? null })),
  }));
}

/** One more card (lost one replaced, or a new one into the game). */
export async function addPassCard(db: Executor) {
  const [{ n }] = await db.select({ n: count() }).from(passCards);
  for (;;) {
    const code = randomBytes(3).toString("hex").toUpperCase();
    const rows = await db
      .insert(passCards)
      .values({ code, label: `Kartička ${n + 1}` })
      .onConflictDoNothing()
      .returning();
    if (rows.length) return rows[0];
  }
}

/** Out of the game (lost) or back in; back in, its month starts again at the next scan. */
export const setPassCardActive = (db: Executor, id: string, isActive: boolean) =>
  db
    .update(passCards)
    .set(isActive ? { isActive, validUntil: null, expiredNotifiedAt: null } : { isActive })
    .where(eq(passCards.id, id));

/** An expired card back in the game – its month starts again at the next scan. */
export const renewPassCard = (db: Executor, id: string) =>
  db.update(passCards).set({ validUntil: null, expiredNotifiedAt: null }).where(eq(passCards.id, id));

/** Closes the card's open round – two places again (the round is full, „Přijdu sama“, or by hand in the admin). */
export async function chargePassCard(db: Executor, id: string, now = new Date()) {
  await db.update(passCardUses).set({ rechargedAt: now }).where(and(eq(passCardUses.cardId, id), isNull(passCardUses.rechargedAt)));
  await db.update(passCards).set({ placesLeft: CARD_PLACES }).where(eq(passCards.id, id));
}

/**
 * Reset by hand – whatever state it got into, the card works again: in the game,
 * charged with both places (an open round is closed) and its month starting at
 * the next scan. Whoever came on it stays in its chain.
 */
export async function resetPassCard(db: Executor, id: string, now = new Date()) {
  await chargePassCard(db, id, now);
  await db.update(passCards).set({ isActive: true, validUntil: null, expiredNotifiedAt: null }).where(eq(passCards.id, id));
}

/**
 * Someone opened the card's page – scanned its QR code, or followed a link to it. Any card that exists
 * counts, even one out of the game or expired (the studio may want to bring it back).
 */
export async function recordPassCardScan(db: Executor, code: string, userId: string | null, now = new Date()) {
  if (!isCardCode(code)) return false;
  const [card] = await db.select({ id: passCards.id }).from(passCards).where(eq(passCards.code, norm(code)));
  if (!card) return false;
  await db.insert(passCardScans).values({ cardId: card.id, userId, createdAt: now });
  return true;
}

/** Admin overview: the cards' scans and the sign-ups with them since then, newest first. */
export async function passCardActivity(db: Executor, since: Date) {
  const [scans, signUps] = await Promise.all([
    db
      .select({ at: passCardScans.createdAt, label: passCards.label, userId: users.id, name: users.name })
      .from(passCardScans)
      .innerJoin(passCards, eq(passCardScans.cardId, passCards.id))
      .leftJoin(users, eq(passCardScans.userId, users.id))
      .where(gte(passCardScans.createdAt, since))
      .orderBy(desc(passCardScans.createdAt)),
    db
      .select({ at: passCardUses.createdAt, label: passCards.label, userId: users.id, name: users.name })
      .from(passCardUses)
      .innerJoin(passCards, eq(passCardUses.cardId, passCards.id))
      .innerJoin(users, eq(passCardUses.userId, users.id))
      .where(gte(passCardUses.createdAt, since))
      .orderBy(desc(passCardUses.createdAt)),
  ]);
  return { scans, signUps };
}

/* ---------------------------------------------------- notices for the studio */

const cardUseRows = (db: Executor) => {
  const from = alias(users, "from_user");
  return db
    .select({
      use: passCardUses,
      label: passCards.label,
      placesLeft: passCards.placesLeft,
      userName: users.name,
      email: users.email,
      deletedAt: users.deletedAt,
      fromName: from.name,
    })
    .from(passCardUses)
    .innerJoin(passCards, eq(passCardUses.cardId, passCards.id))
    .innerJoin(users, eq(passCardUses.userId, users.id))
    .leftJoin(from, eq(passCardUses.fromUserId, from.id))
    .$dynamic();
};

/** Sign-ups with a card the studio hasn't been told about yet. */
export const unannouncedSignUps = (db: Executor) =>
  cardUseRows(db).where(isNull(passCardUses.registeredNotifiedAt)).orderBy(asc(passCardUses.createdAt));

/** Lessons booked with a card's free entry, not announced yet. */
export async function unannouncedBookings(db: Executor) {
  const rows = await cardUseRows(db).where(and(isNull(passCardUses.bookedNotifiedAt), sql`${passCardUses.entitlementId} is not null`));
  const lessons = await cardBookings(db, rows.map((r) => r.use.entitlementId!));
  return rows.flatMap((r) => {
    const lesson = lessons.find((l) => l.entitlementId === r.use.entitlementId && l.status !== "no_show");
    return lesson ? [{ ...r, lesson }] : [];
  });
}

/** Cards that ran out of their month the studio hasn't heard about yet. */
export const unannouncedExpiries = (db: Executor, now = new Date()) =>
  db
    .select({ id: passCards.id, label: passCards.label, validUntil: passCards.validUntil })
    .from(passCards)
    .where(and(eq(passCards.isActive, true), sql`${passCards.validUntil} <= ${now}`, isNull(passCards.expiredNotifiedAt)));

export const markExpiryAnnounced = (db: Executor, id: string, now = new Date()) =>
  db.update(passCards).set({ expiredNotifiedAt: now }).where(eq(passCards.id, id));

export const markSignUpAnnounced = (db: Executor, useId: string, now = new Date()) =>
  db.update(passCardUses).set({ registeredNotifiedAt: now }).where(eq(passCardUses.id, useId));

export const markBookingAnnounced = (db: Executor, useId: string, now = new Date()) =>
  db.update(passCardUses).set({ bookedNotifiedAt: now }).where(eq(passCardUses.id, useId));
