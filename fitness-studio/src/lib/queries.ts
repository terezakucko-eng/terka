import { and, asc, count, desc, eq, gte, inArray, lt, ne } from "drizzle-orm";
import type { DB } from "@/db";
import {
  announcements,
  bookings,
  classSessions,
  classTypes,
  instructors,
  products,
} from "@/db/schema";
import { OCCUPYING } from "@/domain/booking";

export type ScheduleItem = Awaited<ReturnType<typeof listSessions>>[number];

/** Sessions in [from, to) with class, instructor, occupancy and my booking. */
export async function listSessions(
  db: DB,
  from: Date,
  to: Date,
  opts: { classTypeId?: string; userId?: string | null; includeCancelled?: boolean } = {},
) {
  const rows = await db
    .select({ s: classSessions, ct: classTypes, ins: instructors })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .where(
      and(
        gte(classSessions.startsAt, from),
        lt(classSessions.startsAt, to),
        opts.classTypeId ? eq(classSessions.classTypeId, opts.classTypeId) : undefined,
        opts.includeCancelled === false ? eq(classSessions.status, "scheduled") : undefined,
      ),
    )
    .orderBy(asc(classSessions.startsAt));
  if (!rows.length) return [];
  const ids = rows.map((r) => r.s.id);

  const occ = await db
    .select({ id: bookings.sessionId, n: count() })
    .from(bookings)
    .where(and(inArray(bookings.sessionId, ids), inArray(bookings.status, [...OCCUPYING])))
    .groupBy(bookings.sessionId);
  const occMap = new Map(occ.map((o) => [o.id, o.n]));

  const mine = opts.userId
    ? await db
        .select({ id: bookings.sessionId, status: bookings.status })
        .from(bookings)
        .where(
          and(
            inArray(bookings.sessionId, ids),
            eq(bookings.userId, opts.userId),
            ne(bookings.status, "cancelled"),
          ),
        )
    : [];
  const mineMap = new Map(mine.map((m) => [m.id, m.status]));

  return rows.map((r) => ({
    ...r.s,
    classType: r.ct,
    instructor: r.ins,
    occupied: occMap.get(r.s.id) ?? 0,
    myStatus: mineMap.get(r.s.id) ?? null,
  }));
}

export async function sessionDetail(db: DB, id: string) {
  const [r] = await db
    .select({ s: classSessions, ct: classTypes, ins: instructors })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .where(eq(classSessions.id, id));
  return r ?? null;
}

export const activeClassTypes = (db: DB) =>
  db.select().from(classTypes).where(eq(classTypes.isActive, true)).orderBy(asc(classTypes.sortOrder), asc(classTypes.name));

export const activeInstructors = (db: DB) =>
  db.select().from(instructors).where(eq(instructors.isActive, true)).orderBy(asc(instructors.sortOrder), asc(instructors.name));

export const activeProducts = (db: DB) =>
  db.select().from(products).where(eq(products.isActive, true)).orderBy(asc(products.sortOrder), asc(products.price));

export const publishedAnnouncements = (db: DB, limit = 3) =>
  db
    .select()
    .from(announcements)
    .where(eq(announcements.isPublished, true))
    .orderBy(desc(announcements.isPinned), desc(announcements.createdAt))
    .limit(limit);
