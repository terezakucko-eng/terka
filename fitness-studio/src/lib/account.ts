import { and, asc, desc, eq, gte, inArray, lt, ne, or } from "drizzle-orm";
import { sessionName } from "./session-name";
import type { DB } from "@/db";
import {
  bookings,
  classSessions,
  classTypes,
  creditTransactions,
  entitlements,
  instructors,
  orders,
} from "@/db/schema";

export async function userBookings(
  db: DB,
  userId: string,
  when: "upcoming" | "past",
  now = new Date(),
  limit = 50,
  /** the client's own list also keeps classes the studio cancelled – so it's clear why they're gone */
  cancelledClasses = false,
) {
  const rows = await db
    .select({ b: bookings, s: classSessions, ct: classTypes, ins: instructors })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .leftJoin(instructors, eq(classSessions.instructorId, instructors.id))
    .where(
      and(
        eq(bookings.userId, userId),
        when === "upcoming"
          ? and(
              gte(classSessions.startsAt, now),
              cancelledClasses
                ? or(ne(bookings.status, "cancelled"), and(eq(classSessions.status, "cancelled"), eq(bookings.isHold, false)))
                : ne(bookings.status, "cancelled"),
            )
          : lt(classSessions.startsAt, now),
      ),
    )
    .orderBy(when === "upcoming" ? asc(classSessions.startsAt) : desc(classSessions.startsAt))
    .limit(limit);
  return rows.map((r) => ({ ...r, ct: { ...r.ct, name: sessionName(r.s, r.ct) } }));
}

export async function userEntitlements(db: DB, userId: string, activeOnly: boolean, now = new Date()) {
  const rows = await db
    .select()
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        activeOnly ? and(eq(entitlements.status, "active"), gte(entitlements.validUntil, now)) : undefined,
      ),
    )
    .orderBy(desc(entitlements.validUntil));
  return activeOnly
    ? rows.filter((e) => e.entriesTotal === null || e.entriesUsed < e.entriesTotal)
    : rows;
}

export const userOrders = (db: DB, userId: string) =>
  db
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), inArray(orders.status, ["paid", "refunded", "pending"])))
    .orderBy(desc(orders.createdAt))
    .limit(50);

export const userLedger = (db: DB, userId: string) =>
  db
    .select()
    .from(creditTransactions)
    .where(eq(creditTransactions.userId, userId))
    .orderBy(desc(creditTransactions.createdAt))
    .limit(50);
