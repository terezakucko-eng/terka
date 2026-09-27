import { and, eq, gt, inArray, isNull, notExists, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { bookings, classSessions, classTypes, orders } from "@/db/schema";
import { UserError } from "@/lib/errors";

/**
 * Deletes a class type. Sessions nobody booked or paid for go away with it.
 * If some sessions have booking/payment history, the type is archived instead
 * (hidden everywhere, history kept). Upcoming sessions with live bookings block
 * the delete – those must be cancelled first so clients get their entry back.
 */
export async function deleteClassType(db: DB, id: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [live] = await tx
      .select({ n: sql<number>`count(distinct ${classSessions.id})::int` })
      .from(classSessions)
      .innerJoin(bookings, eq(bookings.sessionId, classSessions.id))
      .where(
        and(
          eq(classSessions.classTypeId, id),
          eq(classSessions.status, "scheduled"),
          gt(classSessions.startsAt, now),
          inArray(bookings.status, ["confirmed", "waitlist", "pending_payment"]),
        ),
      );
    if (live.n > 0)
      throw new UserError(
        `Tahle lekce má v rozvrhu ${live.n} ${live.n === 1 ? "nadcházející termín" : "nadcházející termíny"} s rezervacemi. ` +
          "Nejdřív je v Rozvrhu zruš (klienti dostanou vstup zpět), pak ji můžeš smazat.",
      );

    // Sessions without any booking or order – safe to remove entirely.
    await tx
      .delete(classSessions)
      .where(
        and(
          eq(classSessions.classTypeId, id),
          notExists(tx.select({ x: sql`1` }).from(bookings).where(eq(bookings.sessionId, classSessions.id))),
          notExists(tx.select({ x: sql`1` }).from(orders).where(eq(orders.sessionId, classSessions.id))),
        ),
      );

    const [left] = await tx
      .select({ n: sql<number>`count(*)::int` })
      .from(classSessions)
      .where(eq(classSessions.classTypeId, id));
    if (left.n === 0) {
      await tx.delete(classTypes).where(eq(classTypes.id, id));
      return "deleted" as const;
    }
    await tx
      .update(classTypes)
      .set({ isActive: false, archivedAt: now, slug: sql`${classTypes.slug} || '-smazano-' || substr(${classTypes.id}::text, 1, 8)` })
      .where(and(eq(classTypes.id, id), isNull(classTypes.archivedAt)));
    return "archived" as const;
  });
}
