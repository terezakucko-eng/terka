import { and, eq, gt, inArray, isNotNull, isNull, lt, max, or, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { bookings, classSessions, entitlements, users } from "@/db/schema";
import { dateKey } from "@/lib/dates";
import type { Settings } from "@/lib/settings";

const DAY = 86_400_000;

/**
 * Automatic greetings: on a client's birthday (with a free lesson as a gift)
 * and name day, and a „Chybíš nám“ e-mail after a few weeks without a lesson.
 * Each goes out once – the user row remembers it.
 */

/** Today's "MM-DD" in Prague; a 29 February birthday is celebrated on the 28th in common years. */
export function celebrationDays(now: Date) {
  const key = dateKey(now);
  const y = +key.slice(0, 4);
  const md = key.slice(5);
  const leap = (y % 4 === 0 && y % 100 !== 0) || y % 400 === 0;
  return md === "02-28" && !leap ? ["02-28", "02-29"] : [md];
}

const clients = and(eq(users.role, "client"), isNull(users.deletedAt));

/** Clients celebrating today who haven't been greeted this year. */
export async function dueGreetings(db: Executor, now = new Date()) {
  const year = +dateKey(now).slice(0, 4);
  const days = celebrationDays(now);
  const pick = { id: users.id, email: users.email, name: users.name };
  const [birthdays, nameDays] = await Promise.all([
    db
      .select(pick)
      .from(users)
      .where(
        and(
          clients,
          isNotNull(users.birthDate),
          inArray(sql<string>`substring(${users.birthDate} from 6 for 5)`, days),
          or(isNull(users.birthdayGreetedYear), lt(users.birthdayGreetedYear, year)),
        ),
      ),
    db
      .select(pick)
      .from(users)
      .where(and(clients, inArray(users.nameDay, days), or(isNull(users.nameDayGreetedYear), lt(users.nameDayGreetedYear, year)))),
  ]);
  return { year, birthdays, nameDays };
}

/**
 * Marks the birthday as greeted (only once, even if two runs overlap) and
 * gives the gift. Returns the gift's expiry, null without a gift, or false
 * when someone else already greeted this client this year.
 */
export async function greetBirthday(db: DB, userId: string, year: number, cfg: Settings, now = new Date()) {
  return db.transaction(async (tx) => {
    const marked = await tx
      .update(users)
      .set({ birthdayGreetedYear: year })
      .where(and(eq(users.id, userId), or(isNull(users.birthdayGreetedYear), lt(users.birthdayGreetedYear, year))))
      .returning({ id: users.id });
    if (!marked.length) return false as const;
    if (cfg.birthdayGiftEntries <= 0) return null;
    const until = new Date(now.getTime() + Math.max(1, cfg.birthdayGiftValidityDays) * DAY);
    await tx.insert(entitlements).values({
      userId,
      kind: "free",
      name: "Dárek k narozeninám 🎂",
      entriesTotal: cfg.birthdayGiftEntries,
      validFrom: now,
      validUntil: until,
      note: `Automaticky k narozeninám ${year}`,
    });
    return until;
  });
}

/** Marks the name day as greeted; false when it already was this year. */
export async function markNameDay(db: Executor, userId: string, year: number) {
  const marked = await db
    .update(users)
    .set({ nameDayGreetedYear: year })
    .where(and(eq(users.id, userId), or(isNull(users.nameDayGreetedYear), lt(users.nameDayGreetedYear, year))))
    .returning({ id: users.id });
  return marked.length > 0;
}

/** Longer than this without a lesson and they've probably moved on – no e-mail then. */
const WINBACK_MAX_DAYS = 180;

/**
 * Clients with news consent whose last lesson was `days` ago or more, who
 * have nothing booked and haven't had this e-mail since they last came.
 */
export async function dueWinbacks(db: Executor, days: number, now = new Date(), limit = 50) {
  if (days <= 0) return [];
  const last = max(classSessions.startsAt);
  const rows = await db
    .select({ id: users.id, email: users.email, name: users.name, token: users.unsubscribeToken, lastVisit: last })
    .from(users)
    // a visit = a past lesson they were booked on (attendance isn't always marked)
    .innerJoin(bookings, and(eq(bookings.userId, users.id), inArray(bookings.status, ["attended", "confirmed"]), eq(bookings.isHold, false)))
    .innerJoin(classSessions, and(eq(bookings.sessionId, classSessions.id), eq(classSessions.status, "scheduled"), lt(classSessions.startsAt, now)))
    .where(
      and(
        clients,
        eq(users.marketingConsent, true),
        sql`not exists (select 1 from ${bookings} b join ${classSessions} s on s.id = b.session_id
          where b.user_id = ${users.id} and b.status in ('confirmed', 'pending_payment', 'waitlist') and s.starts_at > ${now})`,
      ),
    )
    .groupBy(users.id)
    .having(
      and(
        lt(last, new Date(now.getTime() - days * DAY)),
        gt(last, new Date(now.getTime() - WINBACK_MAX_DAYS * DAY)),
        or(isNull(users.winbackSentAt), sql`${users.winbackSentAt} < ${last}`),
      ),
    )
    .limit(limit);
  return rows.map((r) => ({ ...r, lastVisit: r.lastVisit! }));
}

export const markWinback = (db: Executor, userId: string, now = new Date()) =>
  db.update(users).set({ winbackSentAt: now }).where(eq(users.id, userId));
