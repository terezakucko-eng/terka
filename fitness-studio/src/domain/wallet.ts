import { eq } from "drizzle-orm";
import type { Executor } from "@/db";
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
    .select({ balance: users.creditBalance })
    .from(users)
    .where(eq(users.id, c.userId))
    .for("update");
  if (!user) throw new UserError("Klient neexistuje.");

  const balanceAfter = user.balance + c.delta;
  if (balanceAfter < 0) throw new UserError("Nemáš dostatek kreditu.");

  await tx
    .update(users)
    .set({ creditBalance: balanceAfter })
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
