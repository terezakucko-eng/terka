import { and, asc, eq, gt, gte, isNull, lt, lte, ne, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import {
  massageAvailability,
  massageBookings,
  massageServices,
  type MassageBooking,
  type MassageService,
} from "@/db/schema";
import { addDays, dateKey, pragueLocalToDate } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { getSettings } from "@/lib/settings";

const MIN = 60_000;
type Range = { startsAt: Date; endsAt: Date };

/**
 * Free start times for a massage of `durationMin` inside the availability
 * windows, keeping `bufferMin` between bookings. Pure – easy to test.
 */
export function computeSlots(opts: {
  windows: Range[];
  booked: Range[];
  durationMin: number;
  stepMin: number;
  bufferMin: number;
  notBefore: Date;
}): Date[] {
  const { windows, booked, durationMin, bufferMin, notBefore } = opts;
  const step = Math.max(5, opts.stepMin) * MIN;
  const out: Date[] = [];
  for (const w of [...windows].sort((a, b) => +a.startsAt - +b.startsAt)) {
    for (let t = +w.startsAt; t + durationMin * MIN <= +w.endsAt; t += step) {
      if (t < +notBefore) continue;
      const end = t + durationMin * MIN;
      const clash = booked.some(
        (b) => t < +b.endsAt + bufferMin * MIN && end + bufferMin * MIN > +b.startsAt,
      );
      if (!clash) out.push(new Date(t));
    }
  }
  return out;
}

export const activeMassageServices = (db: Executor) =>
  db
    .select()
    .from(massageServices)
    .where(and(eq(massageServices.isActive, true), isNull(massageServices.archivedAt)))
    .orderBy(asc(massageServices.sortOrder), asc(massageServices.name));

/** Free slots for a service over the booking window, grouped by Prague day. */
export async function freeSlotsByDay(db: DB, service: MassageService, now = new Date()) {
  const cfg = await getSettings(db);
  const until = pragueLocalToDate(addDays(dateKey(now), cfg.bookingWindowDays + 1));
  const [windows, booked] = await Promise.all([
    db
      .select()
      .from(massageAvailability)
      .where(and(gt(massageAvailability.endsAt, now), lt(massageAvailability.startsAt, until))),
    db
      .select({ startsAt: massageBookings.startsAt, endsAt: massageBookings.endsAt })
      .from(massageBookings)
      .where(and(eq(massageBookings.status, "confirmed"), gt(massageBookings.endsAt, now))),
  ]);
  const slots = computeSlots({
    windows,
    booked,
    durationMin: service.durationMin,
    stepMin: cfg.massageStepMinutes,
    bufferMin: cfg.massageBufferMinutes,
    notBefore: new Date(+now + cfg.bookingCutoffMinutes * MIN),
  }).filter((d) => d < until);
  const byDay = new Map<string, Date[]>();
  for (const s of slots) {
    const k = dateKey(s);
    byDay.set(k, [...(byDay.get(k) ?? []), s]);
  }
  return byDay;
}

async function assertFree(tx: Executor, startsAt: Date, endsAt: Date, bufferMin: number, exceptId?: string) {
  const [clash] = await tx
    .select({ id: massageBookings.id })
    .from(massageBookings)
    .where(
      and(
        eq(massageBookings.status, "confirmed"),
        lt(massageBookings.startsAt, new Date(+endsAt + bufferMin * MIN)),
        gt(massageBookings.endsAt, new Date(+startsAt - bufferMin * MIN)),
        exceptId ? ne(massageBookings.id, exceptId) : undefined,
      ),
    )
    .limit(1);
  if (clash) throw new UserError("Tenhle čas už je bohužel obsazený. Vyber prosím jiný.");
}

export type MassageInput = {
  serviceId: string;
  startsAt: Date;
  payment: "on_site" | "transfer";
  note?: string | null;
} & (
  | { userId: string; guest?: undefined }
  | { userId?: null; guest: { name: string; phone?: string | null; email?: string | null } }
);

/**
 * Client booking: must fit inside an availability window and the booking
 * window. The containing window row is locked, so two people can't grab the
 * same time at once.
 */
export async function bookMassage(db: DB, input: MassageInput, now = new Date()): Promise<MassageBooking> {
  return db.transaction(async (tx) => {
    const cfg = await getSettings(tx);
    const service = await loadService(tx, input.serviceId);
    const startsAt = input.startsAt;
    const endsAt = new Date(+startsAt + service.durationMin * MIN);
    if (+startsAt < +now + cfg.bookingCutoffMinutes * MIN) throw new UserError("Tenhle termín už nejde rezervovat.");
    const until = pragueLocalToDate(addDays(dateKey(now), cfg.bookingWindowDays + 1));
    if (startsAt >= until) throw new UserError(`Rezervovat jde nejvýš ${cfg.bookingWindowDays} dní dopředu.`);

    const [win] = await tx
      .select({ id: massageAvailability.id })
      .from(massageAvailability)
      .where(and(lte(massageAvailability.startsAt, startsAt), gte(massageAvailability.endsAt, endsAt)))
      .for("update")
      .limit(1);
    if (!win) throw new UserError("V tuhle dobu se nemasíruje. Vyber prosím jiný termín.");
    await assertFree(tx, startsAt, endsAt, cfg.massageBufferMinutes);
    return insertBooking(tx, service, input, endsAt);
  });
}

/** Reception booking (phone, walk-in): any time, only overlaps are checked. */
export async function adminBookMassage(db: DB, input: MassageInput): Promise<MassageBooking> {
  return db.transaction(async (tx) => {
    const cfg = await getSettings(tx);
    const service = await loadService(tx, input.serviceId, true);
    const endsAt = new Date(+input.startsAt + service.durationMin * MIN);
    // serialize reception bookings too
    await tx.execute(sql`select pg_advisory_xact_lock(4242)`);
    await assertFree(tx, input.startsAt, endsAt, cfg.massageBufferMinutes);
    return insertBooking(tx, service, input, endsAt);
  });
}

async function loadService(tx: Executor, id: string, allowInactive = false) {
  const [service] = await tx.select().from(massageServices).where(eq(massageServices.id, id));
  if (!service || service.archivedAt || (!allowInactive && !service.isActive))
    throw new UserError("Tahle masáž už není v nabídce.");
  return service;
}

async function insertBooking(tx: Executor, service: MassageService, input: MassageInput, endsAt: Date) {
  const [b] = await tx
    .insert(massageBookings)
    .values({
      userId: input.userId ?? null,
      serviceId: service.id,
      serviceName: service.name,
      price: service.price,
      startsAt: input.startsAt,
      endsAt,
      payment: input.payment,
      note: input.note || null,
      guestName: input.guest?.name ?? null,
      guestPhone: input.guest?.phone || null,
      guestEmail: input.guest?.email || null,
    })
    .returning();
  return b;
}

/** Client cancels within the storno limit; staff can cancel any time. */
export async function cancelMassage(
  db: DB,
  opts: { bookingId: string; actorId: string; staff?: boolean },
  now = new Date(),
) {
  const cfg = await getSettings(db);
  const [b] = await db.select().from(massageBookings).where(eq(massageBookings.id, opts.bookingId));
  if (!b || (!opts.staff && b.userId !== opts.actorId)) throw new UserError("Rezervace nenalezena.");
  if (b.status === "cancelled") throw new UserError("Rezervace už je zrušená.");
  if (!opts.staff && +b.startsAt - +now < cfg.cancellationHours * 3_600_000)
    throw new UserError(
      `Zrušit online jde nejpozději ${cfg.cancellationHours} h předem. Napiš nám prosím nebo zavolej.`,
    );
  const [out] = await db
    .update(massageBookings)
    .set({ status: "cancelled", cancelledAt: now })
    .where(eq(massageBookings.id, b.id))
    .returning();
  return out;
}

/** Adds availability windows ("Tuesday 14:00–19:00"), optionally weekly. */
export async function addAvailability(
  db: DB,
  opts: { date: string; from: string; to: string; weeks: number },
) {
  const weeks = Math.min(Math.max(opts.weeks, 1), 26);
  const created: Range[] = [];
  await db.transaction(async (tx) => {
    for (let i = 0; i < weeks; i++) {
      const day = addDays(opts.date, i * 7);
      const startsAt = pragueLocalToDate(`${day}T${opts.from}`);
      const endsAt = pragueLocalToDate(`${day}T${opts.to}`);
      if (endsAt <= startsAt) throw new UserError("Konec musí být po začátku.");
      const [overlap] = await tx
        .select({ id: massageAvailability.id })
        .from(massageAvailability)
        .where(and(lt(massageAvailability.startsAt, endsAt), gt(massageAvailability.endsAt, startsAt)))
        .limit(1);
      if (overlap) continue; // already open then – skip silently
      await tx.insert(massageAvailability).values({ startsAt, endsAt });
      created.push({ startsAt, endsAt });
    }
  });
  return created.length;
}

/** Removes a window unless confirmed bookings sit inside it. */
export async function removeAvailability(db: DB, id: string) {
  const [w] = await db.select().from(massageAvailability).where(eq(massageAvailability.id, id));
  if (!w) return;
  const [inside] = await db
    .select({ id: massageBookings.id })
    .from(massageBookings)
    .where(
      and(
        eq(massageBookings.status, "confirmed"),
        lt(massageBookings.startsAt, w.endsAt),
        gt(massageBookings.endsAt, w.startsAt),
      ),
    )
    .limit(1);
  if (inside) throw new UserError("V tomhle čase už je rezervovaná masáž. Nejdřív ji zruš nebo přesuň.");
  await db.delete(massageAvailability).where(eq(massageAvailability.id, id));
}

/** Deletes a service; with booking history it is archived instead. */
export async function deleteMassageService(db: DB, id: string, now = new Date()) {
  const [upcoming] = await db
    .select({ id: massageBookings.id })
    .from(massageBookings)
    .where(
      and(eq(massageBookings.serviceId, id), eq(massageBookings.status, "confirmed"), gt(massageBookings.startsAt, now)),
    )
    .limit(1);
  if (upcoming) throw new UserError("Tuhle masáž má někdo zarezervovanou. Nejdřív rezervaci zruš.");
  const [any] = await db
    .select({ id: massageBookings.id })
    .from(massageBookings)
    .where(eq(massageBookings.serviceId, id))
    .limit(1);
  if (!any) {
    await db.delete(massageServices).where(eq(massageServices.id, id));
    return "deleted" as const;
  }
  await db
    .update(massageServices)
    .set({
      isActive: false,
      archivedAt: now,
      slug: sql`${massageServices.slug} || '-smazano-' || substr(${massageServices.id}::text, 1, 8)`,
    })
    .where(eq(massageServices.id, id));
  return "archived" as const;
}
