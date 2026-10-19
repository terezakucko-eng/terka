import { randomBytes } from "node:crypto";
import { and, asc, count, eq } from "drizzle-orm";
import { alias } from "drizzle-orm/pg-core";
import type { Executor } from "@/db";
import { passCardUses, passCards, users } from "@/db/schema";
import { pluralCs } from "@/lib/money";
import { displayName } from "@/lib/profile";

/**
 * Pošli to dál: a few printed cards with a QR code that travel from person to
 * person. A newcomer who signs up through a card gets more free lessons than
 * the usual welcome one and becomes the card's holder – the one to pass it on.
 */

/** „dostane 2 lekce zdarma“ */
export const lessonsFree = (n: number) => `${pluralCs(n, "lekci", "lekce", "lekcí")} zdarma`;

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
    holder: row.name ? displayName({ name: row.name, nickname: row.nickname }) : null,
    people: n,
  };
}

/**
 * A new client signed up with the card (inside the registration's transaction):
 * she is recorded as the one who came on it and becomes its holder.
 * Returns null for an unknown or withdrawn card – then it's an ordinary sign-up.
 */
export async function claimPassCard(tx: Executor, code: string, userId: string) {
  if (!isCardCode(code)) return null;
  const [card] = await tx
    .select()
    .from(passCards)
    .where(and(eq(passCards.code, norm(code)), eq(passCards.isActive, true)))
    .for("update");
  if (!card) return null;
  await tx.insert(passCardUses).values({ cardId: card.id, userId, fromUserId: card.holderId });
  await tx.update(passCards).set({ holderId: userId }).where(eq(passCards.id, card.id));
  return card;
}

/** The card the client has to pass on (Můj účet). */
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

/** Admin overview: every card, who has it now and the whole chain. */
export async function listPassCards(db: Executor) {
  const holder = alias(users, "holder");
  const cards = await db
    .select({ card: passCards, holderName: holder.name })
    .from(passCards)
    .leftJoin(holder, eq(passCards.holderId, holder.id))
    .orderBy(asc(passCards.createdAt), asc(passCards.label));
  const from = alias(users, "from_user");
  const uses = await db
    .select({ cardId: passCardUses.cardId, at: passCardUses.createdAt, userId: users.id, name: users.name, fromName: from.name })
    .from(passCardUses)
    .innerJoin(users, eq(passCardUses.userId, users.id))
    .leftJoin(from, eq(passCardUses.fromUserId, from.id))
    .orderBy(asc(passCardUses.createdAt));
  return cards.map(({ card, holderName }) => ({
    ...card,
    holderName,
    chain: uses.filter((u) => u.cardId === card.id),
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
