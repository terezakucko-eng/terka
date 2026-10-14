import { and, asc, eq, gte, inArray, isNull } from "drizzle-orm";
import type { Executor } from "@/db";
import { bookings, classSessions, classTypes, massageBookings, users } from "@/db/schema";
import { site } from "@/config/site";
import type { CalendarEvent } from "@/lib/ics";
import { sessionName } from "@/lib/session-name";

const DAY = 86_400_000;
const host = new URL(site.url).host;

type Session = Pick<typeof classSessions.$inferSelect, "id" | "title" | "startsAt" | "durationMin" | "room">;

/** One lesson as a calendar event. */
export function lessonEvent(s: Session, ct: { name: string }, address: string, uid = `lekce-${s.id}@${host}`): CalendarEvent {
  return {
    uid,
    title: `${sessionName(s, ct)} · ${site.name}`,
    start: s.startsAt,
    end: new Date(s.startsAt.getTime() + s.durationMin * 60_000),
    location: s.room ? `${s.room}, ${address}` : address,
    description: `Detail a storno: ${site.url}/rozvrh/${s.id}`,
    url: `${site.url}/rozvrh/${s.id}`,
  };
}

/** The client's calendar: booked lessons and massages from two months back on. */
export async function calendarEvents(db: Executor, userId: string, address: string, now = new Date()): Promise<CalendarEvent[]> {
  const since = new Date(now.getTime() - 60 * DAY);
  const [lessons, massages] = await Promise.all([
    db
      .select({ b: bookings, s: classSessions, ct: classTypes })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
      .where(
        and(
          eq(bookings.userId, userId),
          inArray(bookings.status, ["confirmed", "pending_payment", "attended"]),
          eq(classSessions.status, "scheduled"),
          gte(classSessions.startsAt, since),
        ),
      )
      .orderBy(asc(classSessions.startsAt)),
    db
      .select()
      .from(massageBookings)
      .where(and(eq(massageBookings.userId, userId), eq(massageBookings.status, "confirmed"), gte(massageBookings.startsAt, since)))
      .orderBy(asc(massageBookings.startsAt)),
  ]);
  return [
    ...lessons.map(({ b, s, ct }) => {
      const e = lessonEvent(s, ct, address, `rezervace-${b.id}@${host}`);
      return b.guestName ? { ...e, description: `S kamarádkou: ${b.guestName}\n${e.description}` } : e;
    }),
    ...massages.map(
      (m): CalendarEvent => ({
        uid: `masaz-${m.id}@${host}`,
        title: `${m.serviceName} · ${site.name}`,
        start: m.startsAt,
        end: m.endsAt,
        location: address,
        description: `Detail a storno: ${site.url}/masaze/rezervace/${m.id}`,
        url: `${site.url}/masaze/rezervace/${m.id}`,
      }),
    ),
  ].sort((a, b) => +a.start - +b.start);
}

/** Owner of a calendar feed address (deleted accounts have none). */
export async function calendarOwner(db: Executor, token: string) {
  if (!/^[0-9a-f]{32}$/.test(token)) return null;
  const [u] = await db
    .select({ id: users.id })
    .from(users)
    .where(and(eq(users.calendarToken, token), isNull(users.deletedAt)));
  return u ?? null;
}
