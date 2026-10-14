import { and, eq, gte, inArray, lt, min } from "drizzle-orm";
import type { Executor } from "@/db";
import { bookings, classSessions, classTypes, orders, products, users } from "@/db/schema";
import { dateKey, pragueHour, pragueLocalToDate, weekdayOf } from "@/lib/dates";
import { currentPeriod, shiftPeriod } from "./membership-fees";

/**
 * Admin → Statistiky: revenue by month, visits (new vs returning clients),
 * occupancy by class type and by weekday × hour – for the last N months.
 * Counted in JS on Prague dates; a studio's data is small.
 */

/** Revenue groups, in the order they are shown. */
export const REVENUE_GROUPS = ["Členství", "Permanentky a kredit", "Jednorázové vstupy", "Masáže", "Poukazy", "Ostatní"] as const;
export type RevenueGroup = (typeof REVENUE_GROUPS)[number];

function revenueGroup(kind: string, productKind: string | null): RevenueGroup {
  if (kind === "membership_fee" || kind === "renewal" || productKind === "membership") return "Členství";
  if (productKind === "pass" || productKind === "credit_pack") return "Permanentky a kredit";
  if (kind === "drop_in" || kind === "surcharge") return "Jednorázové vstupy";
  if (kind === "massage" || productKind === "massage_pass") return "Masáže";
  if (kind === "voucher") return "Poukazy";
  return "Ostatní";
}

/** Seats that count as booked (for occupancy) and as a visit (someone came or was expected). */
const BOOKED = ["confirmed", "attended", "no_show"] as const;
const VISIT = new Set(["confirmed", "attended"]);

export async function studioStats(db: Executor, months: number, now = new Date()) {
  const last = currentPeriod(now);
  const periods = Array.from({ length: months }, (_, i) => shiftPeriod(last, i - months + 1));
  const from = pragueLocalToDate(`${periods[0]}-01T00:00`);

  const [sessionRows, orderRows, newClients] = await Promise.all([
    db
      .select({ id: classSessions.id, startsAt: classSessions.startsAt, capacity: classSessions.capacity, typeId: classTypes.id, type: classTypes.name })
      .from(classSessions)
      .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
      .where(and(eq(classSessions.status, "scheduled"), gte(classSessions.startsAt, from), lt(classSessions.startsAt, now))),
    db
      .select({ amount: orders.amount, kind: orders.kind, paidAt: orders.paidAt, productKind: products.kind })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(and(eq(orders.status, "paid"), gte(orders.paidAt, from))),
    db
      .select({ id: users.id })
      .from(users)
      .where(and(eq(users.role, "client"), gte(users.createdAt, from))),
  ]);
  const sessionIds = sessionRows.map((s) => s.id);
  const bookingRows = sessionIds.length
    ? await db
        .select({ sessionId: bookings.sessionId, userId: bookings.userId, status: bookings.status, seats: bookings.seats, isHold: bookings.isHold })
        .from(bookings)
        .where(and(inArray(bookings.sessionId, sessionIds), inArray(bookings.status, [...BOOKED])))
    : [];
  // each client's very first visit ever – „new“ in the month it happened
  const userIds = [...new Set(bookingRows.filter((b) => !b.isHold && VISIT.has(b.status)).map((b) => b.userId))];
  const firstVisits = userIds.length
    ? await db
        .select({ userId: bookings.userId, first: min(classSessions.startsAt) })
        .from(bookings)
        .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
        .where(
          and(
            inArray(bookings.userId, userIds),
            inArray(bookings.status, ["confirmed", "attended"]),
            eq(bookings.isHold, false),
            eq(classSessions.status, "scheduled"),
          ),
        )
        .groupBy(bookings.userId)
    : [];
  const firstMonth = new Map(firstVisits.map((r) => [r.userId, r.first ? dateKey(r.first).slice(0, 7) : null]));

  const byMonth = new Map(
    periods.map((p) => [p, { period: p, revenue: 0, groups: {} as Partial<Record<RevenueGroup, number>>, visits: 0, active: new Set<string>(), newcomers: new Set<string>() }]),
  );
  for (const o of orderRows) {
    const m = byMonth.get(dateKey(o.paidAt!).slice(0, 7));
    if (!m) continue;
    const g = revenueGroup(o.kind, o.productKind);
    m.revenue += o.amount;
    m.groups[g] = (m.groups[g] ?? 0) + o.amount;
  }

  const sessions = new Map(sessionRows.map((s) => [s.id, { ...s, booked: 0, visits: 0 }]));
  for (const b of bookingRows) {
    const s = sessions.get(b.sessionId)!;
    s.booked += b.seats;
    if (!VISIT.has(b.status)) continue;
    s.visits += b.seats;
    const m = byMonth.get(dateKey(s.startsAt).slice(0, 7))!;
    m.visits += b.seats;
    if (b.isHold) continue;
    m.active.add(b.userId);
    if (firstMonth.get(b.userId) === m.period) m.newcomers.add(b.userId);
  }

  const types = new Map<string, { name: string; sessions: number; seats: number; booked: number; visits: number }>();
  const cells = new Map<string, { weekday: number; hour: number; sessions: number; seats: number; booked: number }>();
  for (const s of sessions.values()) {
    const t = types.get(s.typeId) ?? { name: s.type, sessions: 0, seats: 0, booked: 0, visits: 0 };
    t.sessions++;
    t.seats += s.capacity;
    t.booked += Math.min(s.booked, s.capacity);
    t.visits += s.visits;
    types.set(s.typeId, t);
    const weekday = weekdayOf(dateKey(s.startsAt));
    const hour = pragueHour(s.startsAt);
    const key = `${weekday}-${hour}`;
    const c = cells.get(key) ?? { weekday, hour, sessions: 0, seats: 0, booked: 0 };
    c.sessions++;
    c.seats += s.capacity;
    c.booked += Math.min(s.booked, s.capacity);
    cells.set(key, c);
  }

  const monthsOut = [...byMonth.values()].map((m) => ({
    period: m.period,
    revenue: m.revenue,
    groups: m.groups,
    visits: m.visits,
    clients: m.active.size,
    newcomers: m.newcomers.size,
    returning: m.active.size - m.newcomers.size,
  }));
  const seats = [...types.values()].reduce((n, t) => n + t.seats, 0);
  const booked = [...types.values()].reduce((n, t) => n + t.booked, 0);
  const active = new Set(bookingRows.filter((b) => !b.isHold && VISIT.has(b.status)).map((b) => b.userId));
  return {
    periods,
    months: monthsOut,
    totals: {
      revenue: monthsOut.reduce((n, m) => n + m.revenue, 0),
      visits: monthsOut.reduce((n, m) => n + m.visits, 0),
      occupancy: seats ? booked / seats : null,
      sessions: sessions.size,
      clients: active.size,
      newcomers: monthsOut.reduce((n, m) => n + m.newcomers, 0),
      registrations: newClients.length,
    },
    groups: REVENUE_GROUPS.map((g) => ({ group: g, amount: monthsOut.reduce((n, m) => n + (m.groups[g] ?? 0), 0) })).filter((g) => g.amount > 0),
    types: [...types.values()]
      .map((t) => ({ ...t, occupancy: t.seats ? t.booked / t.seats : 0 }))
      .sort((a, b) => b.occupancy - a.occupancy),
    cells: [...cells.values()].map((c) => ({ ...c, occupancy: c.seats ? c.booked / c.seats : 0 })),
  };
}

export type StudioStats = Awaited<ReturnType<typeof studioStats>>;
