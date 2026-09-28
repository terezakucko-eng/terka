import { and, desc, eq, gt, inArray, lt } from "drizzle-orm";
import type { Executor } from "@/db";
import { entitlements, orders, users, type Order } from "@/db/schema";
import { dateKey, pragueLocalToDate } from "@/lib/dates";
import { UserError } from "@/lib/errors";

/**
 * Monthly membership fee: members commit for 12 months and pay each month,
 * mostly by bank transfer. Every month each member gets one `membership_fee`
 * order (the QR/card payment and "Zaplaceno" flow of orders is reused), and
 * Admin → Příspěvky shows who has paid.
 */

const MONTHS = ["leden", "únor", "březen", "duben", "květen", "červen", "červenec", "srpen", "září", "říjen", "listopad", "prosinec"];

export const isPeriod = (p: string) => /^\d{4}-(0[1-9]|1[0-2])$/.test(p);
export const currentPeriod = (now = new Date()) => dateKey(now).slice(0, 7);
export const periodLabel = (p: string) => `${MONTHS[+p.slice(5, 7) - 1]} ${p.slice(0, 4)}`;
export function shiftPeriod(p: string, by: number) {
  const d = new Date(Date.UTC(+p.slice(0, 4), +p.slice(5, 7) - 1 + by, 1));
  return `${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`;
}
function periodRange(p: string) {
  return { start: pragueLocalToDate(`${p}-01T00:00`), end: pragueLocalToDate(`${shiftPeriod(p, 1)}-01T00:00`) };
}

/**
 * Members whose membership overlaps the month, one row per client (the
 * latest-ending membership decides the fee). Stripe subscriptions pay by
 * themselves and are flagged `auto`.
 */
export async function membersInMonth(db: Executor, period: string) {
  const { start, end } = periodRange(period);
  const rows = await db
    .select({ e: entitlements, name: users.name, email: users.email })
    .from(entitlements)
    .innerJoin(users, eq(entitlements.userId, users.id))
    .where(
      and(
        eq(entitlements.kind, "membership"),
        eq(entitlements.status, "active"),
        lt(entitlements.validFrom, end),
        gt(entitlements.validUntil, start),
      ),
    )
    .orderBy(desc(entitlements.validUntil));
  const byUser = new Map<string, { userId: string; name: string; email: string; monthlyFee: number | null; auto: boolean }>();
  for (const r of rows) {
    const prev = byUser.get(r.e.userId);
    if (prev) {
      prev.auto ||= !!r.e.subscriptionId;
      continue;
    }
    byUser.set(r.e.userId, { userId: r.e.userId, name: r.name, email: r.email, monthlyFee: r.e.monthlyFee, auto: !!r.e.subscriptionId });
  }
  return [...byUser.values()];
}

/** Fee orders of the month (any status except cancelled), newest first per client. */
async function feeOrders(db: Executor, period: string, userIds?: string[]) {
  return db
    .select()
    .from(orders)
    .where(
      and(
        eq(orders.kind, "membership_fee"),
        eq(orders.period, period),
        userIds ? inArray(orders.userId, userIds) : undefined,
      ),
    )
    .orderBy(desc(orders.createdAt));
}

/**
 * Creates the month's fee order for every member who doesn't have one yet.
 * Idempotent – safe to run from the monthly cron after a manual run.
 * `amountKc` is the default fee; a member's own fee wins; `discountPct` applies to both.
 */
export async function createMonthlyFees(
  db: Executor,
  input: { period: string; amountKc: number; discountPct?: number; userIds?: string[] },
): Promise<Order[]> {
  if (!isPeriod(input.period)) throw new UserError("Neplatný měsíc.");
  const discount = Math.min(100, Math.max(0, input.discountPct ?? 0));
  const members = (await membersInMonth(db, input.period)).filter(
    (m) => !m.auto && (!input.userIds || input.userIds.includes(m.userId)),
  );
  if (!members.length) return [];
  const existing = await feeOrders(db, input.period, members.map((m) => m.userId));
  const has = new Set(existing.filter((o) => o.status !== "cancelled").map((o) => o.userId));
  const created: Order[] = [];
  for (const m of members) {
    if (has.has(m.userId)) continue;
    const base = m.monthlyFee ?? Math.round(input.amountKc * 100);
    if (base <= 0) continue;
    const amount = Math.round((base * (100 - discount)) / 100);
    const [o] = await db
      .insert(orders)
      .values({
        userId: m.userId,
        kind: "membership_fee",
        period: input.period,
        description: `Členský příspěvek – ${periodLabel(input.period)}${discount ? ` (sleva ${discount} %)` : ""}`,
        amount,
        provider: "transfer",
        expiresAt: null,
      })
      .returning();
    created.push(o);
  }
  return created;
}

export type FeeRow = {
  userId: string;
  name: string;
  email: string;
  status: "paid" | "pending" | "none" | "auto";
  amount: number | null;
  order: Order | null;
};

/** Who has paid the month's fee. */
export async function feeOverview(db: Executor, period: string) {
  const members = await membersInMonth(db, period);
  const list = await feeOrders(db, period);
  // also show payments of clients whose membership ended meanwhile
  const extra = list.filter((o) => !members.some((m) => m.userId === o.userId) && o.status !== "cancelled");
  const extraUsers = extra.length
    ? await db.select({ id: users.id, name: users.name, email: users.email }).from(users).where(inArray(users.id, extra.map((o) => o.userId)))
    : [];
  const people = [
    ...members,
    ...extraUsers.map((u) => ({ userId: u.id, name: u.name, email: u.email, monthlyFee: null, auto: false })),
  ];
  const rows: FeeRow[] = people.map((m) => {
    const mine = list.filter((o) => o.userId === m.userId && o.status !== "cancelled");
    const order = mine.find((o) => o.status === "paid") ?? mine.find((o) => o.status === "pending") ?? mine[0] ?? null;
    const status: FeeRow["status"] =
      order?.status === "paid" ? "paid" : order?.status === "pending" ? "pending" : m.auto ? "auto" : order ? "pending" : "none";
    return { userId: m.userId, name: m.name, email: m.email, status, amount: order?.amount ?? m.monthlyFee, order };
  });
  const paid = rows.filter((r) => r.status === "paid");
  return {
    rows,
    totals: {
      members: rows.length,
      paid: paid.length,
      pending: rows.filter((r) => r.status === "pending").length,
      none: rows.filter((r) => r.status === "none").length,
      collected: paid.reduce((s, r) => s + (r.amount ?? 0), 0),
      expected: rows.reduce((s, r) => s + (r.status === "auto" ? 0 : r.amount ?? 0), 0),
    },
  };
}

/** Open fee orders of a client (Můj účet). */
export async function openFees(db: Executor, userId: string) {
  return db
    .select()
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee"), eq(orders.status, "pending")))
    .orderBy(orders.period);
}

