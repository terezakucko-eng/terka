import { and, count, eq, gt, or, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { bookings, classSessions, users } from "@/db/schema";
import { UserError } from "@/lib/errors";
import { formatDate } from "@/lib/dates";
import { getSettings } from "@/lib/settings";

const DAY = 86_400_000;

/**
 * Members aren't limited in classes, so a late cancellation or a no-show costs
 * them nothing. Instead each one is a strike: one strike before the limit they
 * get a warning, at the limit they can't book for a few days.
 */
export async function memberStrikes(db: Executor, userId: string, now = new Date()) {
  const cfg = await getSettings(db);
  const [u] = await db.select({ resetAt: users.strikesResetAt }).from(users).where(eq(users.id, userId));
  const windowStart = new Date(now.getTime() - cfg.memberStrikeWindowDays * DAY);
  const since = u?.resetAt && u.resetAt > windowStart ? u.resetAt : windowStart;
  const when = sql`coalesce(${bookings.cancelledAt}, ${classSessions.startsAt})`;
  const [r] = await db
    .select({ n: count() })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.method, "membership"),
        or(and(eq(bookings.status, "cancelled"), eq(bookings.lateCancel, true)), eq(bookings.status, "no_show")),
        gt(when, since),
      ),
    );
  return { strikes: r.n, limit: cfg.memberStrikeLimit, windowDays: cfg.memberStrikeWindowDays, pauseDays: cfg.memberPauseDays };
}

export type StrikeOutcome =
  | { kind: "none" }
  | { kind: "warning"; strikes: number; limit: number; windowDays: number; pauseDays: number }
  | { kind: "paused"; until: Date; strikes: number; pauseDays: number };

/** Call after a member's late cancellation or a no-show was recorded. */
export async function afterMemberStrike(db: DB, userId: string, now = new Date()): Promise<StrikeOutcome> {
  const s = await memberStrikes(db, userId, now);
  if (!s.limit) return { kind: "none" };
  if (s.strikes >= s.limit) {
    const until = new Date(now.getTime() + s.pauseDays * DAY);
    const [u] = await db
      .update(users)
      .set({ bookingPausedUntil: until, strikesResetAt: now })
      .where(and(eq(users.id, userId), or(sql`${users.bookingPausedUntil} is null`, sql`${users.bookingPausedUntil} < ${now}`)))
      .returning({ id: users.id });
    return u ? { kind: "paused", until, strikes: s.strikes, pauseDays: s.pauseDays } : { kind: "none" };
  }
  if (s.strikes === s.limit - 1) return { kind: "warning", ...s };
  return { kind: "none" };
}

/** Throws when the client is paused from booking. */
export async function assertNotPaused(db: Executor, userId: string, now = new Date()) {
  const [u] = await db.select({ until: users.bookingPausedUntil }).from(users).where(eq(users.id, userId));
  if (u?.until && u.until > now)
    throw new UserError(
      `Kvůli opakovanému pozdnímu odhlášení nebo nepříchodu se můžeš znovu přihlašovat od ${formatDate(u.until)}. Na lekce, na které už jsi přihlášen/a, chodit můžeš.`,
    );
}

/** Admin forgives: ends the pause and starts counting strikes from now. */
export async function clearPause(db: Executor, userId: string, now = new Date()) {
  await db.update(users).set({ bookingPausedUntil: null, strikesResetAt: now }).where(eq(users.id, userId));
}
