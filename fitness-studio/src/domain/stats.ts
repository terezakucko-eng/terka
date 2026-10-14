import { and, eq, gte, inArray, lt, min } from "drizzle-orm";
import type { Executor } from "@/db";
import { bookings, classSessions, classTypes, orders, products, users } from "@/db/schema";
import { addDays, dateKey, pragueHour, pragueLocalToDate, weekdayOf } from "@/lib/dates";
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

/** Each client's very first visit ever ("YYYY-MM-DD"), for the clients of these bookings. */
async function firstVisits(db: Executor, rows: { userId: string; status: string; isHold: boolean }[]) {
  const userIds = [...new Set(rows.filter((b) => !b.isHold && VISIT.has(b.status)).map((b) => b.userId))];
  if (!userIds.length) return new Map<string, string>();
  const found = await db
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
    .groupBy(bookings.userId);
  return new Map(found.flatMap((r) => (r.first ? [[r.userId, dateKey(r.first)] as const] : [])));
}

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
  const first = await firstVisits(db, bookingRows);
  const firstMonth = new Map([...first].map(([id, day]) => [id, day.slice(0, 7)]));

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

/**
 * One month day by day (Admin → Statistiky → a month): revenue and its
 * groups, the lessons with their occupancy, visits, clients and newcomers,
 * new registrations. Days up to today.
 */
export async function dailyStats(db: Executor, period: string, now = new Date()) {
  const from = pragueLocalToDate(`${period}-01T00:00`);
  const to = pragueLocalToDate(`${shiftPeriod(period, 1)}-01T00:00`);
  const until = to < now ? to : now;
  const [sessionRows, orderRows, newClients] = await Promise.all([
    db
      .select({ id: classSessions.id, startsAt: classSessions.startsAt, capacity: classSessions.capacity, type: classTypes.name })
      .from(classSessions)
      .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
      .where(and(eq(classSessions.status, "scheduled"), gte(classSessions.startsAt, from), lt(classSessions.startsAt, until)))
      .orderBy(classSessions.startsAt),
    db
      .select({ amount: orders.amount, kind: orders.kind, paidAt: orders.paidAt, productKind: products.kind })
      .from(orders)
      .leftJoin(products, eq(orders.productId, products.id))
      .where(and(eq(orders.status, "paid"), gte(orders.paidAt, from), lt(orders.paidAt, to))),
    db
      .select({ createdAt: users.createdAt })
      .from(users)
      .where(and(eq(users.role, "client"), gte(users.createdAt, from), lt(users.createdAt, to))),
  ]);
  const sessionIds = sessionRows.map((s) => s.id);
  const bookingRows = sessionIds.length
    ? await db
        .select({ sessionId: bookings.sessionId, userId: bookings.userId, status: bookings.status, seats: bookings.seats, isHold: bookings.isHold })
        .from(bookings)
        .where(and(inArray(bookings.sessionId, sessionIds), inArray(bookings.status, [...BOOKED])))
    : [];
  const first = await firstVisits(db, bookingRows);

  const last = dateKey(new Date(until.getTime() - 1));
  const days = new Map<
    string,
    {
      day: string;
      revenue: number;
      payments: number;
      groups: Partial<Record<RevenueGroup, number>>;
      lessons: { time: Date; type: string; capacity: number; booked: number; visits: number }[];
      active: Set<string>;
      newcomers: Set<string>;
      registrations: number;
    }
  >();
  for (let d = `${period}-01`; d <= last; d = addDays(d, 1))
    days.set(d, { day: d, revenue: 0, payments: 0, groups: {}, lessons: [], active: new Set(), newcomers: new Set(), registrations: 0 });

  for (const o of orderRows) {
    const d = days.get(dateKey(o.paidAt!));
    if (!d) continue;
    const g = revenueGroup(o.kind, o.productKind);
    d.revenue += o.amount;
    d.payments++;
    d.groups[g] = (d.groups[g] ?? 0) + o.amount;
  }
  for (const u of newClients) {
    const d = days.get(dateKey(u.createdAt));
    if (d) d.registrations++;
  }
  const lessons = new Map(sessionRows.map((s) => [s.id, { time: s.startsAt, type: s.type, capacity: s.capacity, booked: 0, visits: 0 }]));
  for (const s of sessionRows) days.get(dateKey(s.startsAt))?.lessons.push(lessons.get(s.id)!);
  for (const b of bookingRows) {
    const l = lessons.get(b.sessionId)!;
    l.booked += b.seats;
    if (!VISIT.has(b.status)) continue;
    l.visits += b.seats;
    if (b.isHold) continue;
    const d = days.get(dateKey(l.time))!;
    d.active.add(b.userId);
    if (first.get(b.userId) === d.day) d.newcomers.add(b.userId);
  }

  const out = [...days.values()].map((d) => {
    const seats = d.lessons.reduce((n, l) => n + l.capacity, 0);
    const booked = d.lessons.reduce((n, l) => n + Math.min(l.booked, l.capacity), 0);
    return {
      day: d.day,
      revenue: d.revenue,
      payments: d.payments,
      groups: REVENUE_GROUPS.flatMap((g) => (d.groups[g] ? [{ group: g, amount: d.groups[g]! }] : [])),
      lessons: d.lessons.map((l) => ({ ...l, occupancy: l.capacity ? Math.min(l.booked, l.capacity) / l.capacity : 0 })),
      visits: d.lessons.reduce((n, l) => n + l.visits, 0),
      occupancy: seats ? booked / seats : null,
      clients: d.active.size,
      newcomers: d.newcomers.size,
      registrations: d.registrations,
    };
  });
  const seats = out.flatMap((d) => d.lessons).reduce((n, l) => n + l.capacity, 0);
  const booked = out.flatMap((d) => d.lessons).reduce((n, l) => n + Math.min(l.booked, l.capacity), 0);
  const active = new Set(bookingRows.filter((b) => !b.isHold && VISIT.has(b.status)).map((b) => b.userId));
  return {
    period,
    days: out,
    totals: {
      revenue: out.reduce((n, d) => n + d.revenue, 0),
      payments: out.reduce((n, d) => n + d.payments, 0),
      visits: out.reduce((n, d) => n + d.visits, 0),
      lessons: sessionRows.length,
      occupancy: seats ? booked / seats : null,
      clients: active.size,
      newcomers: out.reduce((n, d) => n + d.newcomers, 0),
      registrations: newClients.length,
    },
  };
}

export type DailyStats = Awaited<ReturnType<typeof dailyStats>>;
