import { and, asc, desc, eq, gt, gte, inArray, isNull, lt, or } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { entitlements, orders, products, users, type Entitlement, type Order, type Product } from "@/db/schema";
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
/** "2026-11" → "1. 11. 2026" (reads well after „od“) */
export const periodStartLabel = (p: string) => `1. ${+p.slice(5, 7)}. ${p.slice(0, 4)}`;
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


/**
 * Records membership fees paid before the web (cash, transfers outside the
 * system) as paid orders, one per month, so the payment history and the
 * insurance confirmation are complete. Months that already have a fee are
 * skipped. Returns the number of months recorded.
 */
export async function recordPastFees(
  db: Executor,
  input: { userId: string; from: string; to: string; amountKc: number },
  now = new Date(),
) {
  if (!isPeriod(input.from) || !isPeriod(input.to) || input.from > input.to) throw new UserError("Zkontroluj měsíce od–do.");
  if (input.to > currentPeriod(now)) throw new UserError("Zapsat jde jen měsíce, které už začaly.");
  const amount = Math.round(input.amountKc * 100);
  if (!(amount > 0)) throw new UserError("Zadej částku za měsíc.");
  const periods: string[] = [];
  for (let p = input.from; p <= input.to; p = shiftPeriod(p, 1)) periods.push(p);
  if (periods.length > 24) throw new UserError("Najednou jde zapsat nejvýš 24 měsíců.");
  const existing = await db
    .select({ period: orders.period })
    .from(orders)
    .where(
      and(
        eq(orders.userId, input.userId),
        eq(orders.kind, "membership_fee"),
        inArray(orders.period, periods),
        inArray(orders.status, ["pending", "paid"]),
      ),
    );
  const has = new Set(existing.map((o) => o.period));
  const todo = periods.filter((p) => !has.has(p));
  if (todo.length) {
    await db.insert(orders).values(
      todo.map((p) => ({
        userId: input.userId,
        kind: "membership_fee" as const,
        period: p,
        description: `Členský příspěvek – ${periodLabel(p)}`,
        amount,
        status: "paid" as const,
        provider: "manual",
        paidAt: pragueLocalToDate(`${p}-01T12:00`),
      })),
    );
  }
  return { recorded: todo.length, skipped: periods.length - todo.length };
}

/** Memberships without commitment among these entitlements (the client may end them). */
export async function flexibleMemberships(db: Executor, entitlementIds: string[]) {
  if (!entitlementIds.length) return new Set<string>();
  const rows = await db
    .select({ id: entitlements.id })
    .from(entitlements)
    .innerJoin(products, eq(entitlements.productId, products.id))
    .where(and(inArray(entitlements.id, entitlementIds), eq(entitlements.kind, "membership"), eq(products.commitmentMonths, 0)));
  return new Set(rows.map((r) => r.id));
}

/**
 * The client ends a membership without commitment: it runs to the end of
 * the last paid month (at least this one), later unpaid fees are dropped.
 * Returns the moment it ends.
 */
export async function endFlexibleMembership(db: DB, userId: string, entitlementId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [row] = await tx
      .select({ e: entitlements, commitment: products.commitmentMonths })
      .from(entitlements)
      .leftJoin(products, eq(entitlements.productId, products.id))
      .where(and(eq(entitlements.id, entitlementId), eq(entitlements.userId, userId)));
    if (!row || row.e.kind !== "membership" || row.e.status !== "active" || row.e.validUntil <= now) throw new UserError("Členství nenalezeno.");
    if (row.commitment !== 0) throw new UserError("Členství se závazkem ukončíš jen po dohodě se studiem – napiš nám prosím.");
    if (row.e.subscriptionId) throw new UserError("Členství placené předplatným kartou ukončíš na recepci.");
    const current = currentPeriod(now);
    const paid = await tx
      .select({ period: orders.period })
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee"), eq(orders.status, "paid"), gte(orders.period, current)));
    const last = [current, ...paid.map((o) => o.period!)].sort().at(-1)!;
    const end = pragueLocalToDate(`${shiftPeriod(last, 1)}-01T00:00`);
    await tx
      .update(entitlements)
      .set({ validUntil: end < row.e.validUntil ? end : row.e.validUntil, renewalCancelled: true })
      .where(eq(entitlements.id, entitlementId));
    // fees for the months after the end are no longer due
    await tx
      .update(orders)
      .set({ status: "cancelled" })
      .where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee"), eq(orders.status, "pending"), gt(orders.period, last)));
    return end < row.e.validUntil ? end : row.e.validUntil;
  });
}

/**
 * Places taken in memberships with a limited number (Členství Reformer):
 * valid memberships of the product (switches from next month included) and
 * orders still waiting for payment, by product id.
 */
export async function membershipPlacesTaken(db: Executor, productIds: string[], now = new Date()) {
  const out = new Map<string, number>(productIds.map((id) => [id, 0]));
  if (!productIds.length) return out;
  const [ents, pending] = await Promise.all([
    db
      .select({ productId: entitlements.productId })
      .from(entitlements)
      .where(and(inArray(entitlements.productId, productIds), eq(entitlements.status, "active"), gt(entitlements.validUntil, now))),
    db
      .select({ productId: orders.productId })
      .from(orders)
      .where(and(inArray(orders.productId, productIds), eq(orders.status, "pending"), or(isNull(orders.expiresAt), gt(orders.expiresAt, now)))),
  ]);
  for (const r of [...ents, ...pending]) if (r.productId) out.set(r.productId, (out.get(r.productId) ?? 0) + 1);
  return out;
}

/** A limited membership has no place left. */
export async function membershipFull(db: Executor, p: Pick<Product, "id" | "maxActive">, now = new Date()) {
  if (p.maxActive === null) return false;
  return ((await membershipPlacesTaken(db, [p.id], now)).get(p.id) ?? 0) >= p.maxActive;
}

/**
 * Higher memberships a client can switch to by themselves (e.g. from
 * Členství to Členství Reformer, 4× Reformer a month included), keyed by
 * entitlement id. Commitment stays as it was: a membership with commitment
 * goes to one with commitment (same end date), one without to one without.
 */
export async function membershipUpgrades(db: Executor, ents: Entitlement[], now = new Date()) {
  const mine = ents.filter(
    (e) => e.kind === "membership" && e.status === "active" && e.validUntil > now && !e.subscriptionId && !e.renewalCancelled && e.includedPerMonth === 0,
  );
  const out = new Map<string, Product>();
  if (!mine.length) return out;
  const listed = await db
    .select()
    .from(products)
    .where(
      and(
        eq(products.kind, "membership"),
        eq(products.isActive, true),
        isNull(products.archivedAt),
        eq(products.linkOnly, false),
        gt(products.includedPerMonth, 0),
        // still sold (one sold from next year can be booked ahead – it starts then)
        or(isNull(products.saleUntil), gt(products.saleUntil, now)),
      ),
    )
    .orderBy(asc(products.sortOrder), asc(products.price));
  const taken = await membershipPlacesTaken(db, listed.flatMap((p) => (p.maxActive !== null ? [p.id] : [])), now);
  const offers = listed.filter((p) => p.maxActive === null || (taken.get(p.id) ?? 0) < p.maxActive);
  if (!offers.length) return out;
  const ids = mine.flatMap((e) => (e.productId ? [e.productId] : []));
  const current = ids.length ? await db.select().from(products).where(inArray(products.id, ids)) : [];
  for (const e of mine) {
    // a membership set up at the reception without a product is one with commitment
    const flexible = current.find((p) => p.id === e.productId)?.commitmentMonths === 0;
    const offer = offers.find((p) => (p.commitmentMonths === 0) === flexible);
    if (offer) out.set(e.id, offer);
  }
  return out;
}

/**
 * The month a switch takes effect: the next one, or later when it is already
 * paid at the old price – and not before the new membership is on sale.
 */
export async function switchPeriod(db: Executor, userId: string, now = new Date(), offer?: Pick<Product, "saleFrom">) {
  let p = shiftPeriod(currentPeriod(now), 1);
  if (offer?.saleFrom && offer.saleFrom > now) p = [p, currentPeriod(offer.saleFrom)].sort().at(-1)!;
  const paid = await db
    .select({ period: orders.period })
    .from(orders)
    .where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee"), eq(orders.status, "paid"), gte(orders.period, p)));
  const done = new Set(paid.map((o) => o.period));
  while (done.has(p)) p = shiftPeriod(p, 1);
  return p;
}

/**
 * The client switches to a higher membership from the next (unpaid) month:
 * the new price applies to that month's fee and later ones, the included
 * lessons from that month on. The membership itself – and its commitment –
 * keeps running.
 */
export async function switchMembership(db: DB, userId: string, entitlementId: string, productId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const [e] = await tx
      .select()
      .from(entitlements)
      .where(and(eq(entitlements.id, entitlementId), eq(entitlements.userId, userId)))
      .for("update");
    if (!e) throw new UserError("Členství nenalezeno.");
    // one place at a time for a limited membership
    if (productId) await tx.select({ id: products.id }).from(products).where(eq(products.id, productId)).for("update");
    const offer = (await membershipUpgrades(tx, [e], now)).get(e.id);
    if (!offer || offer.id !== productId) throw new UserError("Na tohle členství teď přejít nejde – místa jsou možná obsazená. Napiš nám prosím.");
    const period = await switchPeriod(tx, userId, now, offer);
    if (e.validUntil <= pragueLocalToDate(`${period}-01T00:00`)) throw new UserError("Členství končí dřív, než by změna začala platit.");
    await tx
      .update(entitlements)
      .set({
        productId: offer.id,
        name: offer.name,
        monthlyFee: offer.price,
        includedClassTypeId: offer.includedClassTypeId,
        includedPerMonth: offer.includedPerMonth,
        includedFrom: period,
      })
      .where(eq(entitlements.id, e.id));
    // fees already issued for the new months follow the new price
    await tx
      .update(orders)
      .set({ amount: offer.price })
      .where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee"), eq(orders.status, "pending"), gte(orders.period, period)));
    return { period, product: offer, previous: e.name };
  });
}
