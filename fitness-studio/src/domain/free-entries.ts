import { and, eq, gt, isNotNull, isNull, lt, lte, sql } from "drizzle-orm";
import type { DB } from "@/db";
import { entitlements, users } from "@/db/schema";

const DAY_MS = 86_400_000;
/** "The day before": the daily run catches every entry once in this window. */
const LAST_CALL_MS = 1.5 * DAY_MS;
const WEEK_MS = 7 * DAY_MS;

/**
 * Free entries (welcome lesson, birthday gift, invite reward…) the client hasn't
 * used yet and that run out soon: a reminder a week ahead ("week") and the day
 * before ("lastCall"). An entry given for a week or less skips the week one.
 */
export async function freeEntriesExpiring(db: DB, stage: "week" | "lastCall", now = new Date()) {
  const soon = new Date(+now + LAST_CALL_MS);
  return db
    .select({
      id: entitlements.id,
      name: entitlements.name,
      left: sql<number>`${entitlements.entriesTotal} - ${entitlements.entriesUsed}`.mapWith(Number),
      validUntil: entitlements.validUntil,
      email: users.email,
      userName: users.name,
    })
    .from(entitlements)
    .innerJoin(users, eq(entitlements.userId, users.id))
    .where(
      and(
        eq(entitlements.kind, "free"),
        eq(entitlements.status, "active"),
        isNotNull(entitlements.entriesTotal),
        lt(entitlements.entriesUsed, entitlements.entriesTotal),
        gt(entitlements.validUntil, now),
        isNull(users.deletedAt),
        stage === "lastCall"
          ? and(lte(entitlements.validUntil, soon), isNull(entitlements.lastCallAt))
          : and(
              gt(entitlements.validUntil, soon),
              lte(entitlements.validUntil, new Date(+now + WEEK_MS)),
              isNull(entitlements.expiryWarnedAt),
              sql`${entitlements.validUntil} - ${entitlements.createdAt} > interval '8 days'`,
            ),
      ),
    );
}

/** The client was told – a week ahead, or the last day (then the week one is done too). */
export async function markFreeEntryReminded(db: DB, id: string, stage: "week" | "lastCall", now = new Date()) {
  await db
    .update(entitlements)
    .set(stage === "lastCall" ? { lastCallAt: now, expiryWarnedAt: sql`coalesce(${entitlements.expiryWarnedAt}, ${now})` } : { expiryWarnedAt: now })
    .where(eq(entitlements.id, id));
}
