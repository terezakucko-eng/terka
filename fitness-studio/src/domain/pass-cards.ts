import { randomBytes } from "node:crypto";
import { and, asc, count, eq, inArray, isNull, sql } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/db";
import { bookings, classSessions, classTypes, entitlements, passCardUses, passCards, users } from "@/db/schema";
import { displayName } from "@/lib/profile";
import { sessionNameSql } from "@/lib/session-name";

/**
 * Pošli to dál: plastic cards with a QR code that travel from person to person.
 * A charged card gives a newcomer one lesson for two (her and a friend as +1)
 * instead of the usual welcome lesson. Signing up with it empties the card –
 * a photo of the QR code shared around gets nobody else anything – and it
 * charges again once the lesson is over (or the entry ran out unused). The
 * newcomer is then the one who passes the card on.
 */

export const PAIR_NAME = "Vstup pro 2 – Pošli to dál 💛";

export const isCardCode = (code: string) => /^[0-9A-F]{6}$/i.test(code.trim());
const norm = (code: string) => code.trim().toUpperCase();

/** The card behind a QR code, for its landing page (only the holder's first name is shown). */
export async function passCardByCode(db: Executor, code: string) {
  if (!isCardCode(code)) return null;
  const [row] = await db
    .select({ card: passCards, name: users.name, nickname: users.nickname })
    .from(passCards)
    .leftJoin(users, eq(passCards.holderId, users.id))
    .where(eq(passCards.code, norm(code)));
  if (!row) return null;
  const [{ n }] = await db.select({ n: count() }).from(passCardUses).where(eq(passCardUses.cardId, row.card.id));
  return {
    id: row.card.id,
    code: row.card.code,
    label: row.card.label,
    isActive: row.card.isActive,
    charged: row.card.charged,
    holder: row.name ? displayName({ name: row.name, nickname: row.nickname }) : null,
    people: n,
  };
}

/**
 * A new client signed up with the card (inside the registration's transaction):
 * she is recorded as the one who came on it, becomes its holder and the card is
 * empty until her lesson. Null for an unknown, withdrawn or empty card – then
 * it's an ordinary sign-up.
 */
export async function claimPassCard(tx: Executor, code: string, userId: string) {
  if (!isCardCode(code)) return null;
  const [card] = await tx
    .select()
    .from(passCards)
    .where(and(eq(passCards.code, norm(code)), eq(passCards.isActive, true), eq(passCards.charged, true)))
    .for("update");
  if (!card) return null;
  const [use] = await tx.insert(passCardUses).values({ cardId: card.id, userId, fromUserId: card.holderId }).returning();
  await tx.update(passCards).set({ holderId: userId, charged: false }).where(eq(passCards.id, card.id));
  return { ...card, useId: use.id };
}

/** The lesson for two she got with the card – the card charges again once it's used. */
export const linkPassEntitlement = (tx: Executor, useId: string, entitlementId: string) =>
  tx.update(passCardUses).set({ entitlementId }).where(eq(passCardUses.id, useId));

/** The card the client holds (Můj účet): to pass on, or still waiting for her own lesson. */
export async function cardHeldBy(db: Executor, userId: string) {
  const [card] = await db
    .select()
    .from(passCards)
    .where(and(eq(passCards.holderId, userId), eq(passCards.isActive, true)));
  if (!card) return null;
  const [{ n }] = await db.select({ n: count() }).from(passCardUses).where(eq(passCardUses.cardId, card.id));
  return { ...card, people: n };
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

/** Lessons booked with the cards' entries for two – what happened with each use. */
async function pairBookings(db: Executor, entitlementIds: string[]) {
  if (!entitlementIds.length) return [];
  return db
    .select({
      entitlementId: bookings.entitlementId,
      bookingId: bookings.id,
      status: bookings.status,
      guestName: bookings.guestName,
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

/** Admin overview: every card, who has it now and the whole chain with what each one did. */
export async function listPassCards(db: Executor) {
  const holder = alias(users, "holder");
  const cards = await db
    .select({ card: passCards, holderName: holder.name })
    .from(passCards)
    .leftJoin(holder, eq(passCards.holderId, holder.id))
    .orderBy(asc(passCards.createdAt), asc(passCards.label));
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
  const lessons = await pairBookings(db, uses.flatMap((u) => (u.entitlementId ? [u.entitlementId] : [])));
  return cards.map(({ card, holderName }) => ({
    ...card,
    holderName,
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

/** The studio charges the card by hand (an exception – normally it charges itself after the lesson). */
export async function chargePassCard(db: Executor, id: string, now = new Date()) {
  await db.update(passCardUses).set({ rechargedAt: now }).where(and(eq(passCardUses.cardId, id), isNull(passCardUses.rechargedAt)));
  await db.update(passCards).set({ charged: true }).where(eq(passCards.id, id));
}

/* ---------------------------------------------------- notices for the studio */

const cardUseRows = (db: Executor) => {
  const from = alias(users, "from_user");
  return db
    .select({
      use: passCardUses,
      label: passCards.label,
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
export const unannouncedSignUps = (db: Executor) => cardUseRows(db).where(isNull(passCardUses.registeredNotifiedAt));

/** Lessons booked with a card's entry for two, not announced yet. */
export async function unannouncedBookings(db: Executor) {
  const rows = await cardUseRows(db).where(and(isNull(passCardUses.bookedNotifiedAt), sql`${passCardUses.entitlementId} is not null`));
  const lessons = await pairBookings(db, rows.map((r) => r.use.entitlementId!));
  return rows.flatMap((r) => {
    const lesson = lessons.find((l) => l.entitlementId === r.use.entitlementId && l.status !== "no_show");
    return lesson ? [{ ...r, lesson }] : [];
  });
}

export type Recharge = Awaited<ReturnType<typeof unannouncedSignUps>>[number] & {
  /** came = the lesson is over; unused = the entry ran out (or was taken away) without a lesson */
  outcome: "came" | "no_show" | "unused";
  lesson: Awaited<ReturnType<typeof pairBookings>>[number] | null;
};

/** Cards to charge again: their lesson for two is over, or the entry can't be used any more. */
export async function dueRecharges(db: Executor, now = new Date()): Promise<Recharge[]> {
  const open = await cardUseRows(db).where(isNull(passCardUses.rechargedAt));
  if (!open.length) return [];
  const entIds = open.flatMap((r) => (r.use.entitlementId ? [r.use.entitlementId] : []));
  const [lessons, ents] = await Promise.all([
    pairBookings(db, entIds),
    entIds.length ? db.select().from(entitlements).where(inArray(entitlements.id, entIds)) : [],
  ]);
  return open.flatMap((r): Recharge[] => {
    const mine = lessons.filter((l) => l.entitlementId === r.use.entitlementId);
    const over = mine.find((l) => l.endsAt <= now);
    if (over) return [{ ...r, outcome: over.status === "no_show" ? "no_show" : "came", lesson: over }];
    if (mine.length) return []; // booked, the lesson is still ahead
    const e = ents.find((x) => x.id === r.use.entitlementId);
    const unusable = !e || e.status !== "active" || e.validUntil <= now || (e.entriesTotal !== null && e.entriesUsed >= e.entriesTotal);
    return unusable ? [{ ...r, outcome: "unused", lesson: null }] : [];
  });
}

export const markSignUpAnnounced = (db: Executor, useId: string, now = new Date()) =>
  db.update(passCardUses).set({ registeredNotifiedAt: now }).where(eq(passCardUses.id, useId));

export const markBookingAnnounced = (db: Executor, useId: string, now = new Date()) =>
  db.update(passCardUses).set({ bookedNotifiedAt: now }).where(eq(passCardUses.id, useId));

/** Charges the card again after this use; false if someone else already did. */
export async function recharge(db: Executor, r: Recharge, now = new Date()) {
  const done = await db
    .update(passCardUses)
    .set({ rechargedAt: now, bookedNotifiedAt: sql`coalesce(${passCardUses.bookedNotifiedAt}, ${now})` })
    .where(and(eq(passCardUses.id, r.use.id), isNull(passCardUses.rechargedAt)))
    .returning();
  if (!done.length) return false;
  await db.update(passCards).set({ charged: true }).where(eq(passCards.id, r.use.cardId));
  return true;
}
