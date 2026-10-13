import { randomInt } from "node:crypto";
import { and, desc, eq } from "drizzle-orm";
import type { Executor } from "@/db";
import { insuranceConfirmations, orders, products, type Order, type User } from "@/db/schema";
import { dateKey } from "@/lib/dates";
import { UserError } from "@/lib/errors";

/**
 * Potvrzení pro zdravotní pojišťovnu: zaplacené pohybové aktivity klienta
 * za kalendářní rok podle data úhrady – členské příspěvky, členství,
 * permanentky, kredity a jednorázové vstupy. Masáže, solárium a doplatky
 * (např. snídaně u brunche) se nezapočítávají.
 */

const SPORT_PRODUCTS = new Set(["credit_pack", "pass", "membership"]);

export type InsurancePayment = { id: string; date: Date; description: string; amount: number };

export function countsForInsurance(o: Pick<Order, "kind" | "status">, productKind: string | null) {
  if (o.status !== "paid") return false;
  if (o.kind === "product") return !!productKind && SPORT_PRODUCTS.has(productKind);
  return o.kind === "membership_fee" || o.kind === "renewal" || o.kind === "drop_in";
}

/** All paid sport payments of the client, oldest first. */
async function sportPayments(db: Executor, userId: string): Promise<InsurancePayment[]> {
  const rows = await db
    .select({ o: orders, productKind: products.kind })
    .from(orders)
    .leftJoin(products, eq(orders.productId, products.id))
    .where(and(eq(orders.userId, userId), eq(orders.status, "paid")));
  return rows
    .filter((r) => countsForInsurance(r.o, r.productKind))
    .map((r) => ({ id: r.o.id, date: r.o.paidAt ?? r.o.createdAt, description: r.o.description, amount: r.o.amount }))
    .sort((a, b) => a.date.getTime() - b.date.getTime());
}

const yearOf = (d: Date) => +dateKey(d).slice(0, 4);

/** Years (newest first) in which the client paid for sport – one confirmation each. */
export async function insuranceYears(db: Executor, userId: string) {
  return [...new Set((await sportPayments(db, userId)).map((p) => yearOf(p.date)))].sort((a, b) => b - a);
}

/** The year's payments for the confirmation and their total (haléře). */
export async function insurancePayments(db: Executor, userId: string, year: number) {
  const items = (await sportPayments(db, userId)).filter((p) => yearOf(p.date) === year);
  return { items, total: items.reduce((s, p) => s + p.amount, 0) };
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
/** "7KQ4M2PX" → "7KQ4-M2PX" */
export const formatCode = (code: string) => `${code.slice(0, 4)}-${code.slice(4)}`;
/** What someone typed ("7kq4-m2px ") → "7KQ4M2PX" */
export const normalizeCode = (input: string) => input.toUpperCase().replace(/[^A-Z0-9]/g, "");

async function newCode(db: Executor) {
  for (;;) {
    const code = Array.from({ length: 8 }, () => ALPHABET[randomInt(ALPHABET.length)]).join("");
    const [taken] = await db.select({ id: insuranceConfirmations.id }).from(insuranceConfirmations).where(eq(insuranceConfirmations.code, code));
    if (!taken) return code;
  }
}

/**
 * The year's confirmation with its verification code. Downloading it again
 * with nothing changed reuses the earlier code (and issue date); a new payment
 * or a changed name gives a new one. Null when nothing was paid that year.
 * Without the birth date (the insurance company identifies people by it)
 * there is no confirmation.
 */
export async function issueConfirmation(db: Executor, user: Pick<User, "id" | "name" | "birthDate">, year: number) {
  const birthDate = user.birthDate;
  if (!birthDate) throw new UserError("Bez data narození potvrzení vystavit nejde.");
  const { items, total } = await insurancePayments(db, user.id, year);
  if (!items.length) return null;
  const c = insuranceConfirmations;
  const [same] = await db
    .select()
    .from(c)
    .where(
      and(
        eq(c.userId, user.id),
        eq(c.year, year),
        eq(c.total, total),
        eq(c.payments, items.length),
        eq(c.name, user.name),
        eq(c.birthDate, birthDate),
      ),
    )
    .orderBy(desc(c.createdAt))
    .limit(1);
  const confirmation =
    same ??
    (
      await db
        .insert(c)
        .values({ code: await newCode(db), userId: user.id, year, name: user.name, birthDate, total, payments: items.length })
        .returning()
    )[0];
  return { confirmation, items, total, birthDate };
}

/**
 * The issued confirmation behind a code, for the public check on /overeni.
 * `paidNow` is what the client has paid for that year today – lower than the
 * confirmed total means a payment was refunded after the confirmation.
 */
export async function findConfirmation(db: Executor, input: string) {
  const code = normalizeCode(input);
  if (code.length !== 8) return null;
  const [row] = await db.select().from(insuranceConfirmations).where(eq(insuranceConfirmations.code, code));
  if (!row) return null;
  return { ...row, paidNow: (await insurancePayments(db, row.userId, row.year)).total };
}

/**
 * Once a confirmation exists, the name and birth date on it can't be changed
 * by the client any more (only by the studio) – nobody can issue one for
 * somebody else.
 */
export async function hasConfirmation(db: Executor, userId: string) {
  const [row] = await db
    .select({ id: insuranceConfirmations.id })
    .from(insuranceConfirmations)
    .where(eq(insuranceConfirmations.userId, userId))
    .limit(1);
  return !!row;
}

/**
 * Whether the client can no longer change the birth date in the profile: once
 * a confirmation exists and the date is filled in – an empty one (e.g. the
 * studio downloaded the confirmation first) can still be added, after that the
 * studio changes it. The name is the studio's to change from registration on.
 */
export const birthDateLocked = (confirmed: boolean, birthDate: string | null) => confirmed && !!birthDate;
