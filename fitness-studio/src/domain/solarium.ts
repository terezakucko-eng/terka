import { and, asc, desc, eq, gt, lte, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { entitlements, solariumUses } from "@/db/schema";
import { UserError } from "@/lib/errors";

/** Active solarium passes with minutes left, soonest-expiring first. */
export async function solariumPasses(db: Executor, userId: string, now = new Date()) {
  const rows = await db
    .select()
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.kind, "solarium"),
        eq(entitlements.status, "active"),
        lte(entitlements.validFrom, now),
        gt(entitlements.validUntil, now),
      ),
    )
    .orderBy(asc(entitlements.validUntil));
  return rows
    .map((e) => ({ ...e, left: (e.entriesTotal ?? 0) - e.entriesUsed }))
    .filter((e) => e.left > 0);
}

/**
 * Reception deducts sunbed minutes after a session. Uses the passes that
 * expire first; one visit may span two passes.
 */
export async function deductSolarium(
  db: DB,
  opts: { userId: string; minutes: number; actorId: string },
  now = new Date(),
) {
  if (!Number.isInteger(opts.minutes) || opts.minutes < 1) throw new UserError("Zadej počet minut.");
  return db.transaction(async (tx) => {
    // lock the client's passes so two deductions can't overdraw
    await tx.execute(sql`select 1 from ${entitlements} where ${entitlements.userId} = ${opts.userId} for update`);
    const passes = await solariumPasses(tx, opts.userId, now);
    const available = passes.reduce((s, p) => s + p.left, 0);
    if (available < opts.minutes)
      throw new UserError(
        available
          ? `Klient má na solárium jen ${available} min. Zbytek prodej jednorázově nebo novou permanentku.`
          : "Klient nemá platnou permanentku na solárium.",
      );
    let rest = opts.minutes;
    for (const p of passes) {
      if (!rest) break;
      const take = Math.min(rest, p.left);
      await tx
        .update(entitlements)
        .set({ entriesUsed: sql`${entitlements.entriesUsed} + ${take}` })
        .where(eq(entitlements.id, p.id));
      await tx.insert(solariumUses).values({
        userId: opts.userId,
        entitlementId: p.id,
        minutes: take,
        createdBy: opts.actorId,
      });
      rest -= take;
    }
    return available - opts.minutes;
  });
}

export const recentSolariumUses = (db: DB, userId: string, limit = 10) =>
  db.select().from(solariumUses).where(eq(solariumUses.userId, userId)).orderBy(desc(solariumUses.createdAt)).limit(limit);
