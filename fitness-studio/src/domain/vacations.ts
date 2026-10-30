import { and, asc, eq, gt, gte, inArray, isNull, lt, ne } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import { bookings, classSessions, entitlements, orders, products, vacationDiscounts, vacations, type VacationDiscount } from "@/db/schema";
import { addDays, dateKey, formatDate, isDateKey, pragueLocalToDate } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { formatPrice } from "@/lib/money";
import { getSettings, type Settings } from "@/lib/settings";
import { VACATION, daysByMonth, daysShare, discountNote, vacationEnd, vacationLabel } from "@/lib/vacation";
import { cancelBooking, surchargeCredits } from "./booking";
import { membersInMonth, periodLabel, shiftPeriod } from "./membership-fees";
import { changeCredits } from "./wallet";

/** Zmražení členství (a "vacation" in the code) – see VACATION in lib/vacation. */

const dayStart = (key: string) => pragueLocalToDate(`${key}T00:00`);
/** A discount paid out as credit: the membership has no later fee to take it off. */
const AS_CREDIT = "credit";

/** Memberships a vacation can count on: active, with commitment, paid month by month (not by a card subscription). */
async function memberships(tx: Executor, userId: string, after: Date) {
  const rows = await tx
    .select({ e: entitlements, commitment: products.commitmentMonths })
    .from(entitlements)
    .leftJoin(products, eq(entitlements.productId, products.id))
    .where(and(eq(entitlements.userId, userId), eq(entitlements.kind, "membership"), eq(entitlements.status, "active"), gt(entitlements.validUntil, after)));
  // a membership the studio set up without a product counts as one with commitment
  return rows.filter((r) => r.commitment !== 0).map((r) => r.e);
}

/** Can the client take part (Můj účet shows the section then)? */
export async function vacationEligible(db: Executor, userId: string, now = new Date()) {
  const list = await memberships(db, userId, now > VACATION.from ? now : VACATION.from);
  return list.some((e) => !e.subscriptionId);
}

/** The client's vacations (not cancelled), each with its discounts, earliest first. */
export async function vacationsOf(db: Executor, userId: string) {
  const list = await db
    .select()
    .from(vacations)
    .where(and(eq(vacations.userId, userId), isNull(vacations.cancelledAt)))
    .orderBy(asc(vacations.startsOn));
  const ds = list.length
    ? await db.select().from(vacationDiscounts).where(inArray(vacationDiscounts.vacationId, list.map((v) => v.id)))
    : [];
  return list.map((v) => {
    const discounts = ds.filter((d) => d.vacationId === v.id).sort((a, b) => a.period.localeCompare(b.period));
    return { ...v, label: vacationLabel(v.startsOn, v.endsOn), discounts, discount: discounts.reduce((s, d) => s + d.amount, 0) };
  });
}

/** How many vacations are left in that year (studio-planned ones count too). */
export const vacationsLeft = (list: { startsOn: string }[], year: string) =>
  Math.max(0, VACATION.perYear - list.filter((v) => v.startsOn.startsWith(year)).length);

/** The first day the client can start one now. */
export const firstVacationDay = (now = new Date()) => [VACATION.firstDay, addDays(dateKey(now), VACATION.noticeDays)].sort().at(-1)!;

/** The member's fee for the month (haléře); 0 when not a member then or nothing to pay. */
async function feeFor(tx: Executor, userId: string, period: string, cfg: Settings) {
  const row = (await membersInMonth(tx, period)).find((m) => m.userId === userId);
  return row ? (row.monthlyFee ?? cfg.membershipMonthlyFee * 100) : 0;
}

/**
 * Takes the discount off the month's fee: the request waiting for payment is lowered; paid already
 * (or paid by buying the membership), it goes to the next month; not issued yet, the monthly run takes
 * it off. A membership without a later fee pays it out as credit.
 */
async function applyDiscount(tx: Executor, userId: string, period: string, amount: number, note: string) {
  for (let p = period, i = 0; i < 13; p = shiftPeriod(p, 1), i++) {
    const row = (await membersInMonth(tx, p)).find((m) => m.userId === userId);
    if (!row || row.auto) break;
    const fees = await tx
      .select()
      .from(orders)
      .where(and(eq(orders.userId, userId), eq(orders.kind, "membership_fee"), eq(orders.period, p), ne(orders.status, "cancelled")));
    const pending = fees.find((o) => o.status === "pending");
    if (pending) {
      await tx
        .update(orders)
        .set({ amount: Math.max(0, pending.amount - amount), description: pending.description + note })
        .where(eq(orders.id, pending.id));
      return { feePeriod: p, orderId: pending.id };
    }
    if (fees.length || row.purchaseOrderId || row.monthlyFee === 0) continue;
    return { feePeriod: p, orderId: null };
  }
  await changeCredits(tx, { userId, delta: surchargeCredits(amount), reason: "refund", note: `Zmražení členství${note} (členství už nemá další platbu)` });
  return { feePeriod: AS_CREDIT, orderId: null };
}

/** Cancels the client's classes (and waitlist places) in those days – entries, credit and paid surcharges come back. */
async function cancelClassesIn(db: DB, userId: string, startsOn: string, endsOn: string, now: Date) {
  const rows = await db
    .select({ id: bookings.id, startsAt: classSessions.startsAt })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(bookings.userId, userId),
        inArray(bookings.status, ["confirmed", "pending_payment", "waitlist"]),
        gte(classSessions.startsAt, dayStart(startsOn)),
        lt(classSessions.startsAt, dayStart(addDays(endsOn, 1))),
        gt(classSessions.startsAt, now),
      ),
    )
    .orderBy(asc(classSessions.startsAt));
  for (const r of rows) await cancelBooking(db, { bookingId: r.id, actorId: userId, isAdmin: true, refund: true }, now);
  return rows;
}

/**
 * Plans a vacation week: checks the rules (the studio may skip the notice and the yearly limit),
 * lowers the fees and cancels the week's classes.
 */
export async function planVacation(db: DB, input: { userId: string; startsOn: string; byStudio?: boolean }, now = new Date()) {
  const startsOn = input.startsOn.trim();
  if (!isDateKey(startsOn)) throw new UserError("Vyber den, od kdy si členství zmrazíš.");
  if (startsOn < VACATION.firstDay) throw new UserError(`Zmražení členství platí od ${formatDate(VACATION.from)} – zmrazit si ho můžeš nejdřív od toho dne.`);
  const endsOn = vacationEnd(startsOn);
  if (!input.byStudio && startsOn < firstVacationDay(now))
    throw new UserError(`Členství si zmrazíš nejdřív od ${formatDate(dayStart(firstVacationDay(now)))}.`);
  const label = vacationLabel(startsOn, endsOn);

  const planned = await db.transaction(async (tx) => {
    const ms = (await memberships(tx, input.userId, dayStart(endsOn))).filter((e) => e.validFrom <= dayStart(startsOn));
    if (!ms.length) throw new UserError("Zmrazit si ho může člen se závazkem – na celý ten týden ale platné členství nemáš.");
    if (ms.every((e) => e.subscriptionId)) throw new UserError("Členství placené automaticky kartou – zmražení ti rádi nastavíme na recepci.");
    const mine = await tx.select().from(vacations).where(and(eq(vacations.userId, input.userId), isNull(vacations.cancelledAt))).for("update");
    if (mine.some((v) => v.startsOn <= endsOn && v.endsOn >= startsOn)) throw new UserError("V tu dobu už máš členství zmražené.");
    const year = startsOn.slice(0, 4);
    if (!input.byStudio && vacationsLeft(mine, year) === 0)
      throw new UserError(`V roce ${year} už máš ${VACATION.perYear} zmražení – víc jich za rok nejde.`);

    const [v] = await tx.insert(vacations).values({ userId: input.userId, startsOn, endsOn, byStudio: !!input.byStudio }).returning();
    const cfg = await getSettings(tx);
    const discounts: VacationDiscount[] = [];
    for (const part of daysByMonth(startsOn, endsOn)) {
      const amount = daysShare(await feeFor(tx, input.userId, part.period, cfg), part.days, part.of);
      if (amount <= 0) continue;
      const target = await applyDiscount(tx, input.userId, part.period, amount, discountNote(label, amount));
      const [d] = await tx
        .insert(vacationDiscounts)
        .values({ vacationId: v.id, userId: input.userId, period: part.period, days: part.days, amount, ...target })
        .returning();
      discounts.push(d);
    }
    return { vacation: v, discounts };
  });
  const cancelled = await cancelClassesIn(db, input.userId, startsOn, endsOn, now);
  return { ...planned, label, discount: planned.discounts.reduce((s, d) => s + d.amount, 0), cancelled };
}

/**
 * Cancels a vacation (the client until it starts, the studio any time): a lowered fee waiting
 * for payment goes back up; paid already, the difference comes as a top-up request.
 */
export async function cancelVacation(db: DB, input: { vacationId: string; userId?: string; byStudio?: boolean }, now = new Date()) {
  return db.transaction(async (tx) => {
    const [v] = await tx.select().from(vacations).where(eq(vacations.id, input.vacationId)).for("update");
    if (!v || v.cancelledAt || (!input.byStudio && v.userId !== input.userId)) throw new UserError("Zmražení nenalezeno.");
    if (!input.byStudio && v.startsOn <= dateKey(now)) throw new UserError("Zmražení už začalo – zrušit jde jen do jeho začátku.");
    const label = vacationLabel(v.startsOn, v.endsOn);
    const topUps: number[] = [];
    for (const d of await tx.select().from(vacationDiscounts).where(eq(vacationDiscounts.vacationId, v.id))) {
      const [o] = d.orderId ? await tx.select().from(orders).where(eq(orders.id, d.orderId)) : [];
      if (o?.status === "pending") {
        await tx
          .update(orders)
          .set({ amount: o.amount + d.amount, description: o.description.replace(discountNote(label, d.amount), "") })
          .where(eq(orders.id, o.id));
      } else if (o?.status === "paid" || d.feePeriod === AS_CREDIT) {
        const period = d.feePeriod === AS_CREDIT ? d.period : d.feePeriod;
        await tx.insert(orders).values({
          userId: v.userId,
          kind: "membership_fee",
          period,
          description: `Doplatek členského příspěvku – ${periodLabel(period)} (zrušené zmražení ${label})`,
          amount: d.amount,
          provider: "transfer",
          expiresAt: null,
        });
        topUps.push(d.amount);
      }
      // not issued yet: the monthly run simply won't take it off
    }
    await tx.delete(vacationDiscounts).where(eq(vacationDiscounts.vacationId, v.id));
    await tx.update(vacations).set({ cancelledAt: now }).where(eq(vacations.id, v.id));
    return { vacation: v, label, topUp: topUps.reduce((s, n) => s + n, 0) };
  });
}

/** "350 Kč z platby za únor 2027" for each month the vacation lowers. */
export const discountText = (discounts: Pick<VacationDiscount, "feePeriod" | "amount">[]) =>
  discounts
    .map((d) => `${formatPrice(d.amount)} ${d.feePeriod === AS_CREDIT ? "jako kredit" : `z platby za ${periodLabel(d.feePeriod)}`}`)
    .join(" a ");
