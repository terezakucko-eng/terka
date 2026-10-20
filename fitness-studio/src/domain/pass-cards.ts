import { randomBytes } from "node:crypto";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/db";
import { bookings, classSessions, classTypes, entitlements, passCardUses, passCards, users } from "@/db/schema";
import { sessionNameSql } from "@/lib/session-name";

/**
 * Pošli to dál: plastic cards with a QR code that travel from person to person.
 * A charged card has two places, one for each new client who signs up with it –
 * a newcomer and the friend she brings (who scans it too, or gets the link from
 * her account). Each gets one lesson free instead of the welcome lesson and pays
 * for it at booking with „Kartička Pošli to dál“ – existing clients never see it.
 * With both places taken the card waits; once both have had their lesson (or the
 * entry ran out) it charges itself again. A photo of the QR code passed around
 * gets at most the two places.
 */

export const CARD_PLACES = 2;
export const CARD_ENTRY_NAME = "Kartička Pošli to dál – lekce zdarma 💛";

export const isCardCode = (code: string) => /^[0-9A-F]{6}$/i.test(code.trim());
const norm = (code: string) => code.trim().toUpperCase();

/** The card behind a QR code, for its landing page. */
export async function passCardByCode(db: Executor, code: string) {
  if (!isCardCode(code)) return null;
  const [card] = await db.select().from(passCards).where(eq(passCards.code, norm(code)));
  if (!card) return null;
  const [{ n }] = await db.select({ n: count() }).from(passCardUses).where(eq(passCardUses.cardId, card.id));
  return { id: card.id, code: card.code, label: card.label, isActive: card.isActive, placesLeft: card.placesLeft, people: n };
}

/**
 * A new client signed up with the card (inside the registration's transaction):
 * she takes one of its places and is recorded as the one who came on it. Null
 * for an unknown, withdrawn or empty card – then it's an ordinary sign-up.
 */
export async function claimPassCard(tx: Executor, code: string, userId: string) {
  if (!isCardCode(code)) return null;
  const [card] = await tx
    .select()
    .from(passCards)
    .where(and(eq(passCards.code, norm(code)), eq(passCards.isActive, true), sql`${passCards.placesLeft} > 0`))
    .for("update");
  if (!card) return null;
  const [use] = await tx.insert(passCardUses).values({ cardId: card.id, userId, fromUserId: card.holderId }).returning();
  await tx.update(passCards).set({ holderId: userId, placesLeft: card.placesLeft - 1 }).where(eq(passCards.id, card.id));
  return { ...card, placesLeft: card.placesLeft - 1, useId: use.id };
}

/** The free lesson she got with the card – the card charges again once it's used. */
export const linkPassEntitlement = (tx: Executor, useId: string, entitlementId: string) =>
  tx.update(passCardUses).set({ entitlementId }).where(eq(passCardUses.id, useId));

/**
 * The card the client came with, for Můj účet – while it's still about her: her
 * own lesson is ahead, or she was among the last two and nobody has used it since.
 */
export async function myPassCard(db: Executor, userId: string) {
  const [row] = await db
    .select({ use: passCardUses, card: passCards })
    .from(passCardUses)
    .innerJoin(passCards, eq(passCardUses.cardId, passCards.id))
    .where(and(eq(passCardUses.userId, userId), eq(passCards.isActive, true)));
  if (!row) return null;
  const open = !row.use.rechargedAt;
  if (!open) {
    // charged again after her round – still hers to pass on until someone new signs up with it
    const since = await db
      .select({ id: passCardUses.id })
      .from(passCardUses)
      .where(and(eq(passCardUses.cardId, row.card.id), sql`${passCardUses.createdAt} > ${row.use.createdAt}`, sql`(${passCardUses.rechargedAt} is null or ${passCardUses.rechargedAt} > ${row.use.rechargedAt})`))
      .limit(1);
    if (since.length) return null;
  }
  const [{ n }] = await db.select({ n: count() }).from(passCardUses).where(eq(passCardUses.cardId, row.card.id));
  return { ...row.card, open, people: n };
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
      rechargedAt: passCardUses.rechargedAt,
    })
    .from(passCardUses)
    .innerJoin(users, eq(passCardUses.userId, users.id))
    .leftJoin(from, eq(passCardUses.fromUserId, from.id))
    .orderBy(asc(passCardUses.createdAt));
  const lessons = await cardBookings(db, uses.flatMap((u) => (u.entitlementId ? [u.entitlementId] : [])));
  return cards.map((card) => ({
    ...card,
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

export const setPassCardActive = (db: Executor, id: string, isActive: boolean) =>
  db.update(passCards).set({ isActive }).where(eq(passCards.id, id));

/** The studio charges the card by hand (an exception – normally it charges itself after the lessons). */
export async function chargePassCard(db: Executor, id: string, now = new Date()) {
  await db.update(passCardUses).set({ rechargedAt: now }).where(and(eq(passCardUses.cardId, id), isNull(passCardUses.rechargedAt)));
  await db.update(passCards).set({ placesLeft: CARD_PLACES }).where(eq(passCards.id, id));
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

type Row = Awaited<ReturnType<typeof unannouncedSignUps>>[number];
export type Recharge = {
  cardId: string;
  label: string;
  /** the people on the round that emptied the card, with what each did */
  uses: (Row & { outcome: "came" | "no_show" | "unused"; lesson: Awaited<ReturnType<typeof cardBookings>>[number] | null })[];
};

/** Empty cards to charge again: everyone on them has had the lesson, or the entry can't be used any more. */
export async function dueRecharges(db: Executor, now = new Date()): Promise<Recharge[]> {
  const open = await cardUseRows(db).where(and(isNull(passCardUses.rechargedAt), eq(passCards.placesLeft, 0)));
  if (!open.length) return [];
  const entIds = open.flatMap((r) => (r.use.entitlementId ? [r.use.entitlementId] : []));
  const [lessons, ents] = await Promise.all([
    cardBookings(db, entIds),
    entIds.length ? db.select().from(entitlements).where(inArray(entitlements.id, entIds)) : [],
  ]);
  const outcome = (r: Row): Recharge["uses"][number] | null => {
    const mine = lessons.filter((l) => l.entitlementId === r.use.entitlementId);
    const over = mine.find((l) => l.endsAt <= now);
    if (over) return { ...r, outcome: over.status === "no_show" ? "no_show" : "came", lesson: over };
    if (mine.length) return null; // booked, the lesson is still ahead
    const e = ents.find((x) => x.id === r.use.entitlementId);
    const unusable = !e || e.status !== "active" || e.validUntil <= now || (e.entriesTotal !== null && e.entriesUsed >= e.entriesTotal);
    return unusable ? { ...r, outcome: "unused", lesson: null } : null;
  };
  const byCard = new Map<string, Row[]>();
  for (const r of open) byCard.set(r.use.cardId, [...(byCard.get(r.use.cardId) ?? []), r]);
  return [...byCard.entries()].flatMap(([cardId, rows]) => {
    const done = rows.map(outcome);
    return done.every(Boolean) ? [{ cardId, label: rows[0].label, uses: done as Recharge["uses"] }] : [];
  });
}

export const markSignUpAnnounced = (db: Executor, useId: string, now = new Date()) =>
  db.update(passCardUses).set({ registeredNotifiedAt: now }).where(eq(passCardUses.id, useId));

export const markBookingAnnounced = (db: Executor, useId: string, now = new Date()) =>
  db.update(passCardUses).set({ bookedNotifiedAt: now }).where(eq(passCardUses.id, useId));

/** Charges the card again after its round; false if someone else already did. */
export async function recharge(db: Executor, r: Recharge, now = new Date()) {
  const [card] = await db
    .update(passCards)
    .set({ placesLeft: CARD_PLACES })
    .where(and(eq(passCards.id, r.cardId), eq(passCards.placesLeft, 0)))
    .returning();
  if (!card) return false;
  await db
    .update(passCardUses)
    .set({ rechargedAt: now, bookedNotifiedAt: sql`coalesce(${passCardUses.bookedNotifiedAt}, ${now})` })
    .where(and(inArray(passCardUses.id, r.uses.map((u) => u.use.id)), isNull(passCardUses.rechargedAt)));
  return true;
}
