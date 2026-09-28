import { and, eq, gte, inArray, isNull, lt } from "drizzle-orm";
import type { DB } from "@/db";
import { bookings, classSessions, classTypes, massageBookings, users } from "@/db/schema";
import { addDays, dateKey, pragueLocalToDate } from "@/lib/dates";

/** Start and end of tomorrow in Prague (reminders go out the day before). */
function tomorrow(now: Date) {
  const day = addDays(dateKey(now), 1);
  return { from: pragueLocalToDate(day), to: pragueLocalToDate(addDays(day, 1)) };
}

/** Confirmed classes and massages tomorrow whose reminder hasn't been sent yet – only for clients who asked for reminders. */
export async function dueReminders(db: DB, now = new Date()) {
  const { from, to } = tomorrow(now);
  const classes = await db
    .select({ id: bookings.id, sessionId: classSessions.id, startsAt: classSessions.startsAt, name: classTypes.name, email: users.email, userName: users.name })
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
        gte(classSessions.startsAt, from),
        lt(classSessions.startsAt, to),
      ),
    );
  const massages = await db
    .select({ id: massageBookings.id, startsAt: massageBookings.startsAt, name: massageBookings.serviceName, email: users.email, userName: users.name })
    .from(massageBookings)
    .innerJoin(users, eq(massageBookings.userId, users.id))
    .where(
      and(
        eq(massageBookings.status, "confirmed"),
        eq(users.remindersOptIn, true),
        isNull(massageBookings.reminderSentAt),
        gte(massageBookings.startsAt, from),
        lt(massageBookings.startsAt, to),
      ),
    );
  return { classes, massages };
}

export async function markReminded(db: DB, ids: { classes: string[]; massages: string[] }, now = new Date()) {
  if (ids.classes.length) await db.update(bookings).set({ reminderSentAt: now }).where(inArray(bookings.id, ids.classes));
  if (ids.massages.length)
    await db.update(massageBookings).set({ reminderSentAt: now }).where(inArray(massageBookings.id, ids.massages));
}
