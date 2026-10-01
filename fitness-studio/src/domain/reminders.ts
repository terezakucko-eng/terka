import { and, eq, gt, inArray, isNull, lte } from "drizzle-orm";
import { sessionNameSql } from "@/lib/session-name";
import type { DB } from "@/db";
import { bookings, classSessions, classTypes, massageBookings, users } from "@/db/schema";

/** How long before the start the reminder goes out. */
export const REMINDER_HOURS = 3;
const HOUR = 3_600_000;

/**
 * Confirmed classes and massages starting within the next few hours whose reminder
 * hasn't been sent yet – only for clients who asked for reminders, and not for
 * bookings made so late that the confirmation e-mail is reminder enough.
 */
export async function dueReminders(db: DB, now = new Date()) {
  const until = new Date(now.getTime() + REMINDER_HOURS * HOUR);
  const classes = await db
    .select({ id: bookings.id, createdAt: bookings.createdAt, sessionId: classSessions.id, startsAt: classSessions.startsAt, name: sessionNameSql, email: users.email, userName: users.name, userId: users.id })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .innerJoin(users, eq(bookings.userId, users.id))
    .where(
      and(
        eq(bookings.status, "confirmed"),
        eq(users.remindersOptIn, true),
        isNull(bookings.reminderSentAt),
        eq(classSessions.status, "scheduled"),
        gt(classSessions.startsAt, now),
        lte(classSessions.startsAt, until),
      ),
    );
  const massages = await db
    .select({ id: massageBookings.id, startsAt: massageBookings.startsAt, createdAt: massageBookings.createdAt, name: massageBookings.serviceName, email: users.email, userName: users.name, userId: users.id })
    .from(massageBookings)
    .innerJoin(users, eq(massageBookings.userId, users.id))
    .where(
      and(
        eq(massageBookings.status, "confirmed"),
        eq(users.remindersOptIn, true),
        isNull(massageBookings.reminderSentAt),
        gt(massageBookings.startsAt, now),
        lte(massageBookings.startsAt, until),
      ),
    );
  const lateBooked = (created: Date, start: Date) => start.getTime() - created.getTime() < REMINDER_HOURS * HOUR;
  return {
    classes: classes.filter((c) => !lateBooked(c.createdAt, c.startsAt)),
    massages: massages.filter((m) => !lateBooked(m.createdAt, m.startsAt)),
  };
}

export async function markReminded(db: DB, ids: { classes: string[]; massages: string[] }, now = new Date()) {
  if (ids.classes.length) await db.update(bookings).set({ reminderSentAt: now }).where(inArray(bookings.id, ids.classes));
  if (ids.massages.length)
    await db.update(massageBookings).set({ reminderSentAt: now }).where(inArray(massageBookings.id, ids.massages));
}
