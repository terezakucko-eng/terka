import { and, eq, gt, isNull, lte } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { creditTransactions, users } from "@/db/schema";
import { UserError } from "@/lib/errors";

type CreditChange = {
  userId: string;
  delta: number;
  reason: (typeof creditTransactions.$inferInsert)["reason"];
  bookingId?: string | null;
  orderId?: string | null;
  note?: string | null;
  createdBy?: string | null;
};

/**
 * Changes a client's credit balance and writes the ledger entry.
 * Must run inside a transaction – the user row is locked.
 */
export async function changeCredits(tx: Executor, c: CreditChange) {
  const [user] = await tx
    .select({ balance: users.creditBalance, creditExpiresAt: users.creditExpiresAt })
    .from(users)
    .where(eq(users.id, c.userId))
    .for("update");
  if (!user) throw new UserError("Klient neexistuje.");
  if (c.delta < 0 && c.reason === "booking" && creditExpired(user))
    throw new UserError("Platnost kreditu vypršela. Dobij si kredit a platnost se obnoví.");

  const balanceAfter = user.balance + c.delta;
  if (balanceAfter < 0) throw new UserError("Nemáš dostatek kreditu.");

  // money given back as credit mustn't vanish with a validity about to run out
  const refundUntil = c.reason === "refund" && c.delta > 0 && user.creditExpiresAt ? new Date(Date.now() + REFUND_VALIDITY_DAYS * DAY_MS) : null;
  await tx
    .update(users)
    .set({
      creditBalance: balanceAfter,
      ...(refundUntil && user.creditExpiresAt! < refundUntil ? { creditExpiresAt: refundUntil, creditExpiryWarnedAt: null } : {}),
    })
    .where(eq(users.id, c.userId));
  await tx.insert(creditTransactions).values({
    userId: c.userId,
    delta: c.delta,
    balanceAfter,
    reason: c.reason,
    bookingId: c.bookingId ?? null,
    orderId: c.orderId ?? null,
    note: c.note ?? null,
    createdBy: c.createdBy ?? null,
  });
  return balanceAfter;
}

const DAY_MS = 86_400_000;

/** Credit given back (storno, late payment…) stays valid at least this long. */
const REFUND_VALIDITY_DAYS = 60;

/**
 * What a paid drop-in comes back as: the amount paid, 1 Kč = 1 kredit, but
 * never more than the class costs in credits (a free first visit gives nothing).
 */
export function dropInCredit(amountHalere: number, creditCost: number, seats: number) {
  const paid = Math.round(amountHalere / 100);
  return creditCost > 0 ? Math.min(paid, creditCost * seats) : paid;
}

/** A top-up renews validity of the whole balance: max(current expiry, now + days). */
export async function extendCreditValidity(tx: Executor, userId: string, days: number, now = new Date()) {
  const until = new Date(+now + days * DAY_MS);
  const [u] = await tx.select({ exp: users.creditExpiresAt }).from(users).where(eq(users.id, userId));
  const next = u?.exp && u.exp > until ? u.exp : until;
  await tx.update(users).set({ creditExpiresAt: next, creditExpiryWarnedAt: null }).where(eq(users.id, userId));
  return next;
}

/** True when the client's credit has passed its validity (not yet swept by the nightly job). */
export const creditExpired = (u: { creditExpiresAt: Date | null }, now = new Date()) =>
  !!u.creditExpiresAt && u.creditExpiresAt <= now;

/** Nightly: zero out expired balances (logged as "expired"). */
export async function expireCredits(db: DB, now = new Date()) {
  const due = await db
    .select({ id: users.id, balance: users.creditBalance })
    .from(users)
    .where(and(gt(users.creditBalance, 0), lte(users.creditExpiresAt, now)));
  for (const u of due)
    await db.transaction(async (tx) => {
      await changeCredits(tx, { userId: u.id, delta: -u.balance, reason: "expired", note: "Uplynula platnost kreditu" });
      await tx.update(users).set({ creditExpiresAt: null, creditExpiryWarnedAt: null }).where(eq(users.id, u.id));
    });
  return due.length;
}

/** Clients whose credit expires within `days` and who haven't been told yet. */
export async function creditsExpiringSoon(db: DB, now = new Date(), days = 7) {
  return db
    .select({ id: users.id, email: users.email, name: users.name, balance: users.creditBalance, expiresAt: users.creditExpiresAt })
    .from(users)
    .where(
      and(
        gt(users.creditBalance, 0),
        gt(users.creditExpiresAt, now),
        lte(users.creditExpiresAt, new Date(+now + days * DAY_MS)),
        isNull(users.creditExpiryWarnedAt),
      ),
    );
}
