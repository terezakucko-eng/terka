import { isStudent } from "@/lib/student";
import { and, asc, count, eq, gte, inArray, isNull, lt, lte, ne, gt, or, sql } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import {
  bookings,
  classSessions,
  classTypes,
  entitlements,
  orders,
  products,
  users,
  type Booking,
  type ClassSession,
  type Entitlement,
} from "@/db/schema";
import { addDays, dateKey, formatDate, formatDateTime, mondayOf, pragueLocalToDate, weekRange } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { credits as creditsLabel, formatPrice } from "@/lib/money";
import { getSettings, type Settings } from "@/lib/settings";
import { changeCredits, creditExpired } from "./wallet";
import { periodLabel, shiftPeriod } from "./membership-fees";
import { surchargeOn } from "@/lib/price-list";

/** Statuses that take up a spot in the class. */
export const OCCUPYING = [
  "pending_payment",
  "confirmed",
  "attended",
  "no_show",
] as const;

export type Method = NonNullable<Booking["method"]>;

export type BookingOption = {
  method: Method;
  entitlementId?: string;
  label: string;
  detail: string;
  /** Reason the option can't be used right now (shown greyed out). */
  disabled?: string;
  /** drop_in at the student price (the client confirms she studies unless verified) */
  student?: boolean;
};

export type SessionState =
  | "bookable"
  | "full"
  | "past"
  | "cancelled"
  | "not_open"
  | "closed";

const MIN = 60_000;
const HOUR = 60 * MIN;
const DAY = 24 * HOUR;

/**
 * How far ahead a client may book: whole calendar weeks ("this week + N more",
 * opening on Monday 00:00) or a rolling number of days when weeks are 0.
 */
export type BookingWindow = { kind: "weeks" | "days"; n: number };

export function windowOf(cfg: Settings, member: boolean): BookingWindow {
  if (cfg.bookingWindowWeeks > 0)
    return { kind: "weeks", n: member ? Math.max(cfg.memberBookingWindowWeeks, cfg.bookingWindowWeeks) : cfg.bookingWindowWeeks };
  return { kind: "days", n: member ? Math.max(cfg.memberBookingWindowDays, cfg.bookingWindowDays) : cfg.bookingWindowDays };
}

type OpensInput = Pick<ClassSession, "startsAt"> & { bookingOpensAt?: Date | null };

/** When booking opens for a class under the given window (a class can set its own date, e.g. a brunch). */
export function bookingOpensAt(s: OpensInput, w: BookingWindow) {
  if (s.bookingOpensAt) return s.bookingOpensAt;
  if (w.kind === "days") return new Date(s.startsAt.getTime() - w.n * DAY);
  return pragueLocalToDate(`${addDays(mondayOf(dateKey(s.startsAt)), -7 * w.n)}T00:00`);
}

/**
 * For a class this viewer can't book yet: when it opens for them, and whether
 * members can already book it (→ "Pro členy už teď · ostatní od 5. 10.").
 */
export function opensFor(s: OpensInput, mine: BookingWindow, cfg: Settings, now: Date) {
  const at = bookingOpensAt(s, mine);
  if (at <= now) return null;
  return { at, membersNow: bookingOpensAt(s, windowOf(cfg, true)) <= now };
}

/** First moment that is no longer bookable today (exclusive end of the window). */
export function windowEnd(w: BookingWindow, now: Date) {
  if (w.kind === "days") return new Date(now.getTime() + w.n * DAY);
  return pragueLocalToDate(`${addDays(mondayOf(dateKey(now)), 7 * (w.n + 1))}T00:00`);
}

const sameWindow = (a: BookingWindow, b: BookingWindow) => a.kind === b.kind && a.n === b.n;

export function sessionState(
  s: ClassSession,
  occupied: number,
  cfg: Settings,
  now: Date,
  window: BookingWindow = windowOf(cfg, false),
): SessionState {
  if (s.status === "cancelled") return "cancelled";
  if (s.startsAt <= now) return "past";
  if (s.startsAt.getTime() - cfg.bookingCutoffMinutes * MIN <= now.getTime())
    return "closed";
  if (bookingOpensAt(s, window) > now)
    return "not_open";
  if (occupied >= s.capacity) return "full";
  return "bookable";
}

/** The booking window of this client: members (active membership) get the longer one. */
export async function bookingWindowFor(tx: Executor, cfg: Settings, userId: string | null, now: Date): Promise<BookingWindow> {
  const regular = windowOf(cfg, false);
  const member = windowOf(cfg, true);
  if (!userId || sameWindow(regular, member)) return regular;
  const [m] = await tx
    .select({ id: entitlements.id })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.kind, "membership"),
        eq(entitlements.status, "active"),
        lte(entitlements.validFrom, now),
        gt(entitlements.validUntil, now),
      ),
    )
    .limit(1);
  return m ? member : regular;
}

/** Members' window plus the priority weeks of a membership with lessons included (Členství Reformer). */
export function priorityWindow(cfg: Settings): BookingWindow {
  const m = windowOf(cfg, true);
  const extra = Math.max(0, cfg.includedPriorityWeeks);
  return m.kind === "weeks" ? { kind: "weeks", n: m.n + extra } : { kind: "days", n: m.n + 7 * extra };
}

type SessionKey = Pick<ClassSession, "classTypeId" | "startsAt">;

/** Memberships with this class included that apply to the session (valid then, from their starting month). */
async function includedMemberships(tx: Executor, userIds: string[], s: SessionKey) {
  if (!userIds.length) return [];
  const month = dateKey(s.startsAt).slice(0, 7);
  const rows = await tx
    .select({ userId: entitlements.userId, from: entitlements.includedFrom })
    .from(entitlements)
    .where(
      and(
        inArray(entitlements.userId, userIds),
        eq(entitlements.kind, "membership"),
        eq(entitlements.status, "active"),
        eq(entitlements.includedClassTypeId, s.classTypeId),
        gt(entitlements.includedPerMonth, 0),
        lte(entitlements.validFrom, s.startsAt),
        gt(entitlements.validUntil, s.startsAt),
      ),
    );
  return rows.filter((r) => !r.from || r.from <= month).map((r) => r.userId);
}

/**
 * The viewer's booking window for each class: their usual one, and for a
 * class included in their membership (e.g. Reformer in Členství Reformer)
 * the priority window – they can book it a week before other members.
 */
export async function viewerWindows(tx: Executor, cfg: Settings, userId: string | null, now: Date) {
  const base = await bookingWindowFor(tx, cfg, userId, now);
  const none = { base, widest: base, forSession: ((): BookingWindow => base) as (s: SessionKey) => BookingWindow };
  if (!userId || cfg.includedPriorityWeeks <= 0) return none;
  const tiers = await tx
    .select({ classTypeId: entitlements.includedClassTypeId, from: entitlements.includedFrom, validFrom: entitlements.validFrom, validUntil: entitlements.validUntil })
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.kind, "membership"),
        eq(entitlements.status, "active"),
        gt(entitlements.includedPerMonth, 0),
        gt(entitlements.validUntil, now),
      ),
    );
  if (!tiers.length) return none;
  const prio = priorityWindow(cfg);
  return {
    base,
    widest: prio,
    forSession: (s: SessionKey) =>
      tiers.some(
        (t) =>
          t.classTypeId === s.classTypeId &&
          t.validFrom <= s.startsAt &&
          t.validUntil > s.startsAt &&
          (!t.from || t.from <= dateKey(s.startsAt).slice(0, 7)),
      )
        ? prio
        : base,
  };
}

/* ------------------------------------------- places kept for non-members */

/** Who of these clients has a membership valid at that moment. */
async function membersAt(tx: Executor, userIds: string[], at: Date) {
  if (!userIds.length) return new Set<string>();
  const rows = await tx
    .select({ userId: entitlements.userId })
    .from(entitlements)
    .where(
      and(
        inArray(entitlements.userId, userIds),
        eq(entitlements.kind, "membership"),
        eq(entitlements.status, "active"),
        lte(entitlements.validFrom, at),
        gt(entitlements.validUntil, at),
      ),
    );
  return new Set(rows.map((r) => r.userId));
}

/**
 * Places a class keeps for clients without a membership (e.g. one Reformer
 * place) until its release time (a week before by default): how many are
 * still held – not yet taken by a non-member – and when they're released.
 * Members see the class as full while a place is held for others.
 */
export async function nonMemberHold(tx: Executor, s: Pick<ClassSession, "id" | "classTypeId" | "startsAt">, now: Date) {
  const [ct] = await tx
    .select({ seats: classTypes.nonMemberSeats, hours: classTypes.nonMemberReleaseHours })
    .from(classTypes)
    .where(eq(classTypes.id, s.classTypeId));
  if (!ct || ct.seats <= 0) return { held: 0, releaseAt: null };
  const releaseAt = new Date(s.startsAt.getTime() - Math.max(0, ct.hours) * HOUR);
  if (releaseAt <= now) return { held: 0, releaseAt: null };
  const taken = await tx
    .select({ userId: bookings.userId, seats: bookings.seats })
    .from(bookings)
    .where(and(eq(bookings.sessionId, s.id), inArray(bookings.status, [...OCCUPYING]), eq(bookings.isHold, false)));
  const members = await membersAt(tx, taken.map((b) => b.userId), s.startsAt);
  const byOthers = taken.filter((b) => !members.has(b.userId)).reduce((n, b) => n + b.seats, 0);
  return { held: Math.max(0, ct.seats - byOthers), releaseAt };
}

/** How many places this client can book into: a member doesn't get the ones held for non-members. */
async function capacityFor(tx: Executor, s: ClassSession, userId: string | null, now: Date) {
  const hold = await nonMemberHold(tx, s, now);
  const member = !!userId && hold.held > 0 && (await membersAt(tx, [userId], s.startsAt)).has(userId);
  return { capacity: member ? s.capacity - hold.held : s.capacity, held: member ? hold.held : 0, releaseAt: hold.releaseAt };
}

const heldMessage = (held: number, releaseAt: Date) =>
  `${held === 1 ? "Poslední místo je" : "Poslední místa jsou"} do ${formatDateTime(releaseAt)} pro klienty bez členství. Zapiš se do pořadníku – když ${held === 1 ? "ho" : "je"} nikdo nezabere, dostaneš ho jako první.`;

/** Free cancellation up to this many hours before the class – the lesson's own (Reformer, brunch) or the studio default. */
export async function cancellationHoursFor(tx: Executor, s: Pick<ClassSession, "classTypeId">, cfg: Settings) {
  const [ct] = await tx
    .select({ hours: classTypes.cancellationHours })
    .from(classTypes)
    .where(eq(classTypes.id, s.classTypeId));
  return ct?.hours ?? cfg.cancellationHours;
}

/** " (u lekcí Reformer fusion a Fitness brunch 24 h)" – lessons cancellable on their own terms, for texts; "" when none. */
export function stornoExceptions(types: { name: string; cancellationHours: number | null }[], hours: number) {
  const byHours = new Map<number, string[]>();
  for (const t of types)
    if (t.cancellationHours !== null && t.cancellationHours !== hours)
      byHours.set(t.cancellationHours, [...(byHours.get(t.cancellationHours) ?? []), t.name]);
  const and = new Intl.ListFormat("cs", { type: "conjunction" });
  const parts = [...byHours]
    .sort(([a], [b]) => b - a)
    .map(([h, names]) => `${names.length > 1 ? "u lekcí" : "u lekce"} ${and.format(names)} ${h} h`);
  return parts.length ? ` (${parts.join(", ")})` : "";
}

export function isLateCancel(s: ClassSession, hours: number, now: Date) {
  return now.getTime() > s.startsAt.getTime() - hours * HOUR;
}

async function lockSession(tx: Executor, id: string) {
  const [s] = await tx
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, id))
    .for("update");
  if (!s) throw new UserError("Lekce neexistuje.");
  return s;
}

/** Occupied spots – a booking with a friend (+1) takes two. */
export const seatsTaken = sql<number>`coalesce(sum(${bookings.seats}), 0)::int`;

export async function occupancy(tx: Executor, sessionId: string) {
  const [r] = await tx
    .select({ n: seatsTaken })
    .from(bookings)
    .where(
      and(
        eq(bookings.sessionId, sessionId),
        inArray(bookings.status, [...OCCUPYING]),
      ),
    );
  return r.n;
}

/** Free spots on the given classes, by id – only upcoming, not cancelled ones are in the map. */
export async function seatsLeft(tx: Executor, sessionIds: string[], now = new Date()) {
  if (sessionIds.length === 0) return new Map<string, number>();
  const rows = await tx
    .select({ id: classSessions.id, capacity: classSessions.capacity, taken: seatsTaken })
    .from(classSessions)
    .leftJoin(bookings, and(eq(bookings.sessionId, classSessions.id), inArray(bookings.status, [...OCCUPYING])))
    .where(and(inArray(classSessions.id, sessionIds), eq(classSessions.status, "scheduled"), gt(classSessions.startsAt, now)))
    .groupBy(classSessions.id);
  return new Map(rows.map((r) => [r.id, Math.max(0, r.capacity - r.taken)]));
}

async function activeBooking(tx: Executor, userId: string, sessionId: string) {
  const [b] = await tx
    .select()
    .from(bookings)
    .where(
      and(
        eq(bookings.userId, userId),
        eq(bookings.sessionId, sessionId),
        ne(bookings.status, "cancelled"),
      ),
    );
  return b;
}

/** Releases spots held by unpaid drop-in orders whose time ran out. */
export async function expireStalePending(
  tx: Executor,
  now: Date,
  sessionId?: string,
) {
  const stale = await tx
    .select({ id: orders.id })
    .from(orders)
    .where(
      and(
        eq(orders.status, "pending"),
        lt(orders.expiresAt, now),
        sessionId ? eq(orders.sessionId, sessionId) : undefined,
      ),
    );
  if (!stale.length) return 0;
  const ids = stale.map((o) => o.id);
  await tx.update(orders).set({ status: "expired" }).where(inArray(orders.id, ids));
  await tx
    .update(bookings)
    .set({ status: "cancelled", cancelledAt: now })
    .where(
      and(inArray(bookings.orderId, ids), eq(bookings.status, "pending_payment")),
    );
  return ids.length;
}

/* ------------------------------------------------------------- options */

async function weeklyUsage(tx: Executor, entitlementId: string, s: ClassSession) {
  const { start, end } = weekRange(s.startsAt);
  const [r] = await tx
    .select({ n: count() })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(bookings.entitlementId, entitlementId),
        inArray(bookings.status, [...OCCUPYING]),
        gte(classSessions.startsAt, start),
        lt(classSessions.startsAt, end),
      ),
    );
  return r.n;
}

/** Why an entitlement can't pay for this session, or null if it can. */
/** Per-class-type pricing rules (member / pass surcharge, first visit, free entry). */
async function classRules(tx: Executor, s: Pick<ClassSession, "classTypeId">) {
  const [ct] = await tx
    .select({
      memberSurcharge: classTypes.memberSurcharge,
      memberSurchargeFrom: classTypes.memberSurchargeFrom,
      memberSurchargeNext: classTypes.memberSurchargeNext,
      memberSurchargeNextFrom: classTypes.memberSurchargeNextFrom,
      passSurcharge: classTypes.passSurcharge,
      noFreeEntry: classTypes.noFreeEntry,
      noPass: classTypes.noPass,
      firstVisitPrice: classTypes.firstVisitPrice,
      firstVisitNewOnly: classTypes.firstVisitNewOnly,
      passEntries: classTypes.passEntries,
      duoPrice: classTypes.duoPrice,
      studentDropInPrice: classTypes.studentDropInPrice,
    })
    .from(classTypes)
    .where(eq(classTypes.id, s.classTypeId));
  return ct ?? { memberSurcharge: null, memberSurchargeFrom: null, memberSurchargeNext: null, memberSurchargeNextFrom: null, passSurcharge: null, noFreeEntry: false, noPass: false, firstVisitPrice: null, firstVisitNewOnly: false, passEntries: 1, duoPrice: null, studentDropInPrice: null };
}
type ClassRules = Awaited<ReturnType<typeof classRules>>;

/** Member surcharge that applies to this session (0 = none) – by the price list of its day. */
export function memberSurchargeFor(rules: Parameters<typeof surchargeOn>[0], s: Pick<ClassSession, "startsAt">) {
  return surchargeOn(rules, dateKey(s.startsAt));
}

type Included = Pick<Entitlement, "id" | "includedClassTypeId" | "includedPerMonth" | "includedFrom">;

/**
 * Lessons included in a membership (e.g. 4× Reformer a month with no member
 * surcharge): how many are left in the session's month, or null when the
 * membership includes none of this class then. Bookings within the allowance
 * are the ones without a surcharge; a late cancellation uses one up too.
 */
export async function includedLeft(tx: Executor, e: Included, s: Pick<ClassSession, "startsAt" | "classTypeId">, rules: ClassRules, exceptBookingId?: string) {
  if (!e.includedClassTypeId || e.includedPerMonth <= 0 || e.includedClassTypeId !== s.classTypeId) return null;
  const month = dateKey(s.startsAt).slice(0, 7);
  if (e.includedFrom && month < e.includedFrom) return null;
  // only lessons that would otherwise cost a surcharge count
  const from = [`${month}-01`, rules.memberSurchargeFrom ?? ""].sort().at(-1)!;
  const [r] = await tx
    .select({ n: count() })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(bookings.entitlementId, e.id),
        eq(classSessions.classTypeId, s.classTypeId),
        gte(classSessions.startsAt, pragueLocalToDate(`${from}T00:00`)),
        lt(classSessions.startsAt, pragueLocalToDate(`${shiftPeriod(month, 1)}-01T00:00`)),
        eq(bookings.surcharge, 0),
        or(inArray(bookings.status, [...OCCUPYING]), and(eq(bookings.status, "cancelled"), eq(bookings.lateCancel, true))),
        exceptBookingId ? ne(bookings.id, exceptBookingId) : undefined,
      ),
    );
  return Math.max(0, e.includedPerMonth - r.n);
}

/**
 * Lessons included in these memberships for Můj účet: class name, how many a
 * month, from which month (a switch takes effect later) and how many are
 * left this month (null while no surcharge applies, so nothing is counted).
 */
export async function includedSummary(tx: Executor, ents: Entitlement[], now = new Date()) {
  const out = new Map<string, { className: string; perMonth: number; from: string | null; left: number | null }>();
  const month = dateKey(now).slice(0, 7);
  for (const e of ents) {
    if (e.kind !== "membership" || !e.includedClassTypeId || e.includedPerMonth <= 0) continue;
    const [ct] = await tx.select({ name: classTypes.name }).from(classTypes).where(eq(classTypes.id, e.includedClassTypeId));
    if (!ct) continue;
    const later = !!e.includedFrom && e.includedFrom > month;
    const at = { startsAt: now, classTypeId: e.includedClassTypeId };
    const rules = await classRules(tx, at);
    const left = later || !memberSurchargeFor(rules, at) ? null : await includedLeft(tx, e, at, rules);
    out.set(e.id, { className: ct.name, perMonth: e.includedPerMonth, from: later ? e.includedFrom : null, left });
  }
  return out;
}

/** The membership on offer that includes this class (e.g. Členství Reformer for Reformer) – sold on that day – for the class page. */
export async function membershipIncluding(tx: Executor, classTypeId: string, at = new Date()) {
  const [p] = await tx
    .select({ name: products.name, perMonth: products.includedPerMonth })
    .from(products)
    .where(
      and(
        eq(products.kind, "membership"),
        eq(products.isActive, true),
        eq(products.linkOnly, false),
        isNull(products.archivedAt),
        eq(products.includedClassTypeId, classTypeId),
        gt(products.includedPerMonth, 0),
        or(isNull(products.saleFrom), lte(products.saleFrom, at)),
        or(isNull(products.saleUntil), gt(products.saleUntil, at)),
      ),
    )
    .orderBy(sql`${products.commitmentMonths} = 0`, asc(products.sortOrder))
    .limit(1);
  return p ?? null;
}

/** "na listopad zbývají 3" */
function includedNote(left: number, s: Pick<ClassSession, "startsAt">) {
  const month = periodLabel(dateKey(s.startsAt).slice(0, 7)).split(" ")[0];
  return left === 1 ? `na ${month} zbývá 1` : left < 5 ? `na ${month} zbývají ${left}` : `na ${month} zbývá ${left}`;
}

/** Surcharge for booking with a pass – per seat, on top of the entries (0 = none). */
export const passSurchargeFor = (rules: Pick<ClassRules, "passSurcharge">, seats = 1) => (rules.passSurcharge ?? 0) * seats;

/** What a booking paid with this method costs on top (members' and pass holders' surcharge). */
function surchargeFor(method: Method, rules: ClassRules, s: Pick<ClassSession, "startsAt">, seats: number) {
  if (method === "membership") return memberSurchargeFor(rules, s);
  if (method === "pass") return passSurchargeFor(rules, seats);
  return 0;
}

/** Entries a booking takes from this entitlement: passes may cost more (Reformer = 2), a friend doubles it (free entries too). */
function entriesFor(e: Pick<Entitlement, "kind">, rules: Pick<ClassRules, "passEntries">, seats = 1) {
  return (e.kind === "pass" ? Math.max(1, rules.passEntries) : 1) * seats;
}

/** A friend (+1) can come along only to group classes, not to individual ones. */
export const guestAllowed = (s: Pick<ClassSession, "capacity">) => s.capacity > 2;

/** Drop-in price for the client and a friend: the class type's price for two, else both single prices. */
async function duoDropInPriceFor(tx: Executor, userId: string, s: ClassSession, rules: ClassRules) {
  const single = await dropInPriceFor(tx, userId, s, rules);
  if (!single || s.dropInPrice === null) return null;
  return rules.duoPrice ?? single.price + s.dropInPrice;
}

/** Drop-in price for this client – the intro price if they've never had this class (or, newcomers only, any class). */
async function dropInPriceFor(tx: Executor, userId: string, s: ClassSession, rules: ClassRules) {
  if (rules.firstVisitPrice !== null) {
    const [before] = await tx
      .select({ id: bookings.id })
      .from(bookings)
      .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
      .where(
        and(
          eq(bookings.userId, userId),
          rules.firstVisitNewOnly ? undefined : eq(classSessions.classTypeId, s.classTypeId),
          inArray(bookings.status, ["confirmed", "attended", "no_show", "pending_payment"]),
        ),
      )
      .limit(1);
    if (!before) return { price: rules.firstVisitPrice, intro: true };
  }
  return s.dropInPrice === null ? null : { price: s.dropInPrice, intro: false };
}

async function entitlementProblem(
  tx: Executor,
  e: Entitlement,
  s: ClassSession,
  seats = 1,
): Promise<string | null> {
  if (e.status !== "active") return "Oprávnění není aktivní.";
  if (seats > 1 && e.kind === "membership")
    return "Kamarádku můžeš vzít s permanentkou, vstupem zdarma, kreditem nebo jednorázově.";
  if (e.kind === "pass" && (await classRules(tx, s)).noPass)
    return "Permanentka na tuhle lekci neplatí.";
  if (e.classTypeId && e.classTypeId !== s.classTypeId) return "Platí jen na jinou lekci.";
  // a free entry given for this very class counts even where intro entries don't
  if (e.kind === "free" && !e.classTypeId && (await classRules(tx, s)).noFreeEntry)
    return "Úvodní vstup zdarma na tuhle lekci použít nejde.";
  if (e.validFrom > s.startsAt) return `Platí až od ${formatDate(e.validFrom)}.`;
  if (e.validUntil <= s.startsAt) return "Na datum lekce už neplatí.";
  if (e.entriesTotal !== null) {
    const need = entriesFor(e, await classRules(tx, s), seats);
    if (e.entriesUsed + need > e.entriesTotal)
      return e.entriesUsed >= e.entriesTotal
        ? "Vyčerpané vstupy."
        : `Na tuhle lekci potřebuješ ${need} vstupy, zbývá ti ${e.entriesTotal - e.entriesUsed}.`;
  }
  if (e.weeklyLimit !== null) {
    const used = await weeklyUsage(tx, e.id, s);
    if (used >= e.weeklyLimit)
      return `Týdenní limit ${e.weeklyLimit} lekcí je vyčerpán.`;
  }
  return null;
}

/** Entitlements usable for classes (solarium minutes and massage passes are not). */
type ClassKind = Exclude<Entitlement["kind"], "solarium" | "massage_pass">;
const methodForKind = {
  membership: "membership",
  pass: "pass",
  free: "free",
} as const satisfies Record<ClassKind, Method>;
const isClassKind = (k: Entitlement["kind"]): k is ClassKind =>
  k !== "solarium" && k !== "massage_pass";

/** All ways the client could pay for the session, best first. */
export async function bookingOptions(
  tx: Executor,
  userId: string,
  s: ClassSession,
  seats = 1,
): Promise<BookingOption[]> {
  if (s.isFree) {
    return [
      {
        method: "free_class",
        label: "Lekce zdarma",
        detail: seats > 1 ? "Tahle lekce je zdarma pro tebe i kamarádku." : "Tahle lekce je pro všechny zdarma.",
      },
    ];
  }

  const opts: BookingOption[] = [];
  const ents = await tx
    .select()
    .from(entitlements)
    .where(
      and(
        eq(entitlements.userId, userId),
        eq(entitlements.status, "active"),
        ne(entitlements.kind, "solarium"),
        lte(entitlements.validFrom, s.startsAt),
        gt(entitlements.validUntil, s.startsAt),
      ),
    )
    .orderBy(asc(entitlements.validUntil));

  const rules = await classRules(tx, s);
  const rank: Record<ClassKind, number> = { membership: 0, pass: 1, free: 2 };
  // entries tied to another class (e.g. a free Reformer entry) aren't offered here at all
  const classEnts = ents.flatMap((e) =>
    isClassKind(e.kind) && (!e.classTypeId || e.classTypeId === s.classTypeId) ? [{ ...e, kind: e.kind }] : [],
  );
  classEnts.sort((a, b) => rank[a.kind] - rank[b.kind]);
  for (const e of classEnts) {
    const problem = await entitlementProblem(tx, e, s, seats);
    const need = entriesFor(e, rules, seats);
    const left =
      e.entriesTotal === null
        ? "neomezeně"
        : `zbývá ${e.entriesTotal - e.entriesUsed} z ${e.entriesTotal}` +
          (need > 1 ? ` · strhnou se ${need} vstupy` : "");
    let extra = surchargeFor(methodForKind[e.kind], rules, s, seats);
    let included = "";
    if (e.kind === "membership" && extra > 0) {
      const n = await includedLeft(tx, e, s, rules);
      if (n) {
        extra = 0;
        included = ` · v ceně členství, ${includedNote(n, s)}`;
      } else if (n === 0) included = ", lekce v ceně na tento měsíc jsou vyčerpané";
    }
    opts.push({
      method: methodForKind[e.kind],
      entitlementId: e.id,
      label: e.name,
      detail: extra ? `${left} · doplatek ${formatPrice(extra)} (kartou nebo převodem)${included}` : left + included,
      ...(problem ? { disabled: problem } : {}),
    });
  }

  const [u] = await tx
    .select({ balance: users.creditBalance, creditExpiresAt: users.creditExpiresAt })
    .from(users)
    .where(eq(users.id, userId));
  const balance = u?.balance ?? 0;
  const expired = !!u && creditExpired(u);
  const cost = s.creditCost * seats;
  opts.push({
    method: "credits",
    label: `Zaplatit kreditem (${creditsLabel(cost)}${seats > 1 ? " za obě místa" : ""})`,
    detail: `Na účtu máš ${creditsLabel(balance)}.`,
    ...(expired
      ? { disabled: "Platnost kreditu vypršela." }
      : balance < cost
        ? { disabled: "Nedostatek kreditu." }
        : {}),
  });

  if (seats > 1) {
    const duo = await duoDropInPriceFor(tx, userId, s, rules);
    if (duo !== null)
      opts.push({
        method: "drop_in",
        label: `Jednorázově pro dva ${formatPrice(duo)}`,
        detail: "Zaplatíš převodem.",
      });
    return opts;
  }
  const dropIn = await dropInPriceFor(tx, userId, s, rules);
  if (dropIn) {
    opts.push({
      method: "drop_in",
      label: dropIn.intro ? `První lekce ${formatPrice(dropIn.price)}` : `Jednorázový vstup ${formatPrice(dropIn.price)}`,
      detail: "Zaplatíš online kartou.",
    });
  }
  // cheaper than the regular drop-in only – a student's first lesson may already cost less
  if (rules.studentDropInPrice !== null && (!dropIn || rules.studentDropInPrice < dropIn.price)) {
    opts.push({
      method: "drop_in",
      student: true,
      label: `Studentský vstup ${formatPrice(rules.studentDropInPrice)}`,
      detail: "S ISIC nebo potvrzením o studiu.",
    });
  }
  return opts;
}

/** Picks the first option usable without the client's input (for waitlist / admin). */
function autoOption(opts: BookingOption[]) {
  return opts.find((o) => !o.disabled && o.method !== "drop_in");
}

/* -------------------------------------------------------------- charge */

async function charge(
  tx: Executor,
  booking: Booking,
  s: ClassSession,
  method: Method,
  entitlementId: string | undefined,
) {
  let creditsCharged = 0;
  let entriesCharged = 0;
  let entId: string | null = null;
  let ent: Entitlement | null = null;

  switch (method) {
    case "free_class":
      if (!s.isFree) throw new UserError("Tahle lekce není zdarma.");
      break;
    case "credits":
      creditsCharged = s.creditCost * booking.seats;
      await changeCredits(tx, {
        userId: booking.userId,
        delta: -creditsCharged,
        reason: "booking",
        bookingId: booking.id,
      });
      break;
    case "membership":
    case "pass":
    case "free": {
      if (!entitlementId) throw new UserError("Vyber permanentku.");
      const [e] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, entitlementId))
        .for("update");
      if (!e || e.userId !== booking.userId || !isClassKind(e.kind) || methodForKind[e.kind] !== method)
        throw new UserError("Permanentka nenalezena.");
      const problem = await entitlementProblem(tx, e, s, booking.seats);
      if (problem) throw new UserError(problem);
      if (e.entriesTotal !== null) {
        entriesCharged = entriesFor(e, await classRules(tx, s), booking.seats);
        await tx
          .update(entitlements)
          .set({ entriesUsed: e.entriesUsed + entriesCharged })
          .where(eq(entitlements.id, e.id));
      }
      entId = e.id;
      ent = e;
      break;
    }
    case "admin":
      break;
    case "drop_in":
      throw new Error("drop_in is charged through an order");
  }

  const rules = await classRules(tx, s);
  let surcharge = surchargeFor(method, rules, s, booking.seats);
  // lessons included in the membership (e.g. 4× Reformer a month) need no surcharge
  if (surcharge > 0 && method === "membership" && ent && (await includedLeft(tx, ent, s, rules, booking.id))) surcharge = 0;
  await tx
    .update(bookings)
    .set({
      creditsCharged,
      entriesCharged,
      entitlementId: entId,
      method,
      surcharge,
    })
    .where(eq(bookings.id, booking.id));
}

/**
 * A lesson included in the membership was cancelled in time – the allowance
 * goes to the client's next unpaid surcharged booking of that month, if any.
 */
async function passIncludedOn(tx: Executor, b: Booking, s: ClassSession) {
  if (b.method !== "membership" || b.surcharge !== 0 || !b.entitlementId) return;
  const [e] = await tx.select().from(entitlements).where(eq(entitlements.id, b.entitlementId));
  if (!e || e.includedClassTypeId !== s.classTypeId) return;
  const rules = await classRules(tx, s);
  if (!memberSurchargeFor(rules, s) || !(await includedLeft(tx, e, s, rules))) return;
  const month = dateKey(s.startsAt).slice(0, 7);
  const [next] = await tx
    .select({ id: bookings.id })
    .from(bookings)
    .innerJoin(classSessions, eq(bookings.sessionId, classSessions.id))
    .where(
      and(
        eq(bookings.entitlementId, e.id),
        eq(bookings.status, "confirmed"),
        gt(bookings.surcharge, 0),
        isNull(bookings.surchargePaidAt),
        eq(classSessions.classTypeId, s.classTypeId),
        gte(classSessions.startsAt, pragueLocalToDate(`${month}-01T00:00`)),
        lt(classSessions.startsAt, pragueLocalToDate(`${shiftPeriod(month, 1)}-01T00:00`)),
      ),
    )
    .orderBy(asc(classSessions.startsAt))
    .limit(1);
  if (!next) return;
  await tx.update(bookings).set({ surcharge: 0 }).where(eq(bookings.id, next.id));
  await tx
    .update(orders)
    .set({ status: "cancelled" })
    .where(and(eq(orders.kind, "surcharge"), eq(orders.bookingId, next.id), eq(orders.status, "pending")));
}

/** Gives back whatever the booking cost. */
async function refund(tx: Executor, b: Booking, s: ClassSession, note: string) {
  switch (b.method) {
    case "credits":
      if (b.creditsCharged > 0)
        await changeCredits(tx, {
          userId: b.userId,
          delta: b.creditsCharged,
          reason: "refund",
          bookingId: b.id,
          note,
        });
      break;
    case "drop_in": {
      // Not paid yet (bank transfer pending) – just call the payment off.
      const [o] = b.orderId ? await tx.select().from(orders).where(eq(orders.id, b.orderId)) : [];
      if (o && o.status !== "paid") {
        await tx.update(orders).set({ status: "cancelled" }).where(eq(orders.id, o.id));
        break;
      }
      // Paid entries come back as credit – no refund round-trip needed.
      await changeCredits(tx, {
        userId: b.userId,
        delta: s.creditCost * b.seats,
        reason: "refund",
        bookingId: b.id,
        note: `${note} (jednorázový vstup vrácen jako kredit)`,
      });
      break;
    }
    case "pass":
    case "free":
    case "membership": {
      if (!b.entitlementId) break;
      const [e] = await tx
        .select()
        .from(entitlements)
        .where(eq(entitlements.id, b.entitlementId))
        .for("update");
      if (e && e.entriesTotal !== null && e.entriesUsed > 0) {
        // older bookings didn't record it – those always took one entry
        const back = Math.min(e.entriesUsed, b.entriesCharged || 1);
        await tx
          .update(entitlements)
          .set({ entriesUsed: e.entriesUsed - back })
          .where(eq(entitlements.id, e.id));
      }
      break;
    }
    default:
      break;
  }
}

/* ------------------------------------------------------------ commands */

export type BookInput = {
  userId: string;
  sessionId: string;
  method: Method;
  entitlementId?: string;
  /** Drop-in paid later by bank transfer: the spot is booked right away. */
  payLater?: boolean;
  /** A friend without an account coming along (+1) – takes a second spot. */
  guestName?: string;
  /** drop_in at the student price… */
  student?: boolean;
  /** …which a client not verified yet confirms she studies for (undefined = reception) */
  studentConfirmed?: boolean;
};

export async function bookSession(db: DB, input: BookInput, now = new Date()) {
  return db.transaction(async (tx) => {
    const cfg = await getSettings(tx);
    const s = await lockSession(tx, input.sessionId);
    await expireStalePending(tx, now, s.id);

    const window = (await viewerWindows(tx, cfg, input.userId, now)).forSession(s);
    const occupied = await occupancy(tx, s.id);
    const cap = await capacityFor(tx, s, input.userId, now);
    const state = sessionState({ ...s, capacity: cap.capacity }, occupied, cfg, now, window);
    if (state === "full")
      throw new UserError(
        cap.held && cap.releaseAt && occupied < s.capacity ? heldMessage(cap.held, cap.releaseAt) : "Lekce je plná – můžeš se zapsat do pořadníku.",
      );
    if (state !== "bookable") throw new UserError(stateMessage[state]);
    if (input.method === "admin") throw new UserError("Nepovolená platba.");
    const guestName = input.guestName?.trim().slice(0, 80) || null;
    const seats = guestName ? 2 : 1;
    if (guestName && !guestAllowed(s))
      throw new UserError("Na individuální lekci kamarádku vzít nejde.");
    if (occupied + seats > cap.capacity)
      throw new UserError("Pro dva už tu není místo – zbývá jen jedno.");
    if (s.isFree !== (input.method === "free_class"))
      throw new UserError("Zvol prosím jiný způsob platby.");

    const existing = await activeBooking(tx, input.userId, s.id);
    if (existing?.status === "waitlist") {
      await tx
        .update(bookings)
        .set({ status: "cancelled", cancelledAt: now })
        .where(eq(bookings.id, existing.id));
    } else if (existing) {
      throw new UserError("Na tuhle lekci už jsi přihlášená/ý.");
    }

    if (input.method === "drop_in") {
      const rules = await classRules(tx, s);
      const student = !!input.student && !guestName;
      if (student) {
        if (rules.studentDropInPrice === null) throw new UserError("Na tuhle lekci studentský vstup není.");
        const [u] = await tx.select({ studentUntil: users.studentUntil }).from(users).where(eq(users.id, input.userId));
        if (input.studentConfirmed === false && !isStudent(u, now))
          throw new UserError("Studentský vstup: potvrď prosím, že studuješ. ISIC nebo potvrzení o studiu pak ukážeš ve studiu.");
      }
      const dropIn = student
        ? { price: rules.studentDropInPrice!, intro: false }
        : guestName
          ? await duoDropInPriceFor(tx, input.userId, s, rules).then((price) => price === null ? null : { price, intro: false })
          : await dropInPriceFor(tx, input.userId, s, rules);
      if (!dropIn) throw new UserError("Na tuto lekci nelze koupit jednorázový vstup.");
      const [order] = await tx
        .insert(orders)
        .values({
          userId: input.userId,
          kind: "drop_in",
          sessionId: s.id,
          description: guestName ? "Jednorázový vstup pro dva" : student ? "Studentský vstup" : dropIn.intro ? "První lekce" : "Jednorázový vstup",
          amount: dropIn.price,
          provider: "pending",
          expiresAt: input.payLater ? null : new Date(now.getTime() + cfg.pendingPaymentMinutes * MIN),
        })
        .returning();
      const [booking] = await tx
        .insert(bookings)
        .values({
          userId: input.userId,
          sessionId: s.id,
          status: input.payLater ? "confirmed" : "pending_payment",
          method: "drop_in",
          orderId: order.id,
          guestName,
          seats,
        })
        .returning();
      return { booking, order };
    }

    const [booking] = await tx
      .insert(bookings)
      .values({
        userId: input.userId,
        sessionId: s.id,
        status: "confirmed",
        method: input.method,
        guestName,
        seats,
      })
      .returning();
    await charge(tx, booking, s, input.method, input.entitlementId);
    return { booking, order: null };
  });
}

export const stateMessage: Record<SessionState, string> = {
  bookable: "Volno",
  full: "Lekce je plná.",
  past: "Lekce už proběhla.",
  cancelled: "Lekce byla zrušena.",
  not_open: "Rezervace na tuto lekci ještě nejsou otevřené.",
  closed: "Rezervace na tuto lekci jsou už uzavřené.",
};

export async function joinWaitlist(
  db: DB,
  input: { userId: string; sessionId: string },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const cfg = await getSettings(tx);
    const s = await lockSession(tx, input.sessionId);
    await expireStalePending(tx, now, s.id);
    const window = (await viewerWindows(tx, cfg, input.userId, now)).forSession(s);
    const cap = await capacityFor(tx, s, input.userId, now);
    const state = sessionState({ ...s, capacity: cap.capacity }, await occupancy(tx, s.id), cfg, now, window);
    if (state === "bookable")
      throw new UserError("Na lekci je volné místo – rezervuj rovnou.");
    if (state !== "full") throw new UserError(stateMessage[state]);
    if (await activeBooking(tx, input.userId, s.id))
      throw new UserError("Na tuhle lekci už jsi přihlášená/ý.");
    const [b] = await tx
      .insert(bookings)
      .values({ userId: input.userId, sessionId: s.id, status: "waitlist" })
      .returning();
    return b;
  });
}

/**
 * The waitlist in the order it is served: clients with an active membership
 * at the time of the class first (the membership perk), then everyone else;
 * within each group whoever joined earlier.
 */
export async function waitlistQueue(tx: Executor, s: ClassSession) {
  const waiting = await tx
    .select()
    .from(bookings)
    .where(and(eq(bookings.sessionId, s.id), eq(bookings.status, "waitlist")))
    .orderBy(asc(bookings.createdAt));
  if (!waiting.length) return waiting;
  const members = await membersAt(tx, waiting.map((w) => w.userId), s.startsAt);
  // a membership with this class included (Členství Reformer) goes first – the priority perk
  const tier = new Set(await includedMemberships(tx, [...members], s));
  const rank = (userId: string) => (tier.has(userId) ? 2 : members.has(userId) ? 1 : 0);
  // stable sort keeps the join order inside each group
  return [...waiting].sort((a, b) => rank(b.userId) - rank(a.userId));
}

/** Fills free spots from the waitlist, charging each client automatically. */
async function promoteWaitlist(tx: Executor, s: ClassSession, now: Date) {
  const promoted: Booking[] = [];
  if (s.status !== "scheduled" || s.startsAt <= now) return promoted;

  const waiting = await waitlistQueue(tx, s);

  let free = s.capacity - (await occupancy(tx, s.id));
  for (const w of waiting) {
    if (free <= 0) break;
    // a place held for non-members waits for one of them (or for its release)
    const { held } = await nonMemberHold(tx, s, now);
    if (held > 0 && free <= held && (await membersAt(tx, [w.userId], s.startsAt)).has(w.userId)) continue;
    const opt = autoOption(await bookingOptions(tx, w.userId, s));
    if (!opt) continue;
    await tx
      .update(bookings)
      .set({ status: "confirmed" })
      .where(eq(bookings.id, w.id));
    await charge(tx, w, s, opt.method, opt.entitlementId);
    promoted.push({ ...w, status: "confirmed", method: opt.method });
    free--;
  }
  return promoted;
}

/** Moves the waitlist up now (e.g. when places held for non-members are released). */
export async function fillFromWaitlist(db: DB, sessionId: string, now = new Date()) {
  return db.transaction(async (tx) => promoteWaitlist(tx, await lockSession(tx, sessionId), now));
}

/** Upcoming classes whose places for non-members are already released and that still have a waitlist. */
export async function releasedHoldsWithWaitlist(db: Executor, now = new Date()) {
  const rows = await db
    .select({ id: classSessions.id, startsAt: classSessions.startsAt, hours: classTypes.nonMemberReleaseHours })
    .from(classSessions)
    .innerJoin(classTypes, eq(classSessions.classTypeId, classTypes.id))
    .where(
      and(
        eq(classSessions.status, "scheduled"),
        gt(classSessions.startsAt, now),
        lt(classSessions.startsAt, new Date(now.getTime() + 60 * DAY)),
        gt(classTypes.nonMemberSeats, 0),
        sql`exists (select 1 from ${bookings} b where b.session_id = ${classSessions.id} and b.status = 'waitlist')`,
      ),
    );
  return rows.filter((r) => r.startsAt.getTime() - r.hours * HOUR <= now.getTime()).map((r) => r.id);
}

export async function cancelBooking(
  db: DB,
  input: {
    bookingId: string;
    actorId: string;
    isAdmin?: boolean;
    /** Admin override – refund even after the free-cancellation window. */
    refund?: boolean;
  },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const cfg = await getSettings(tx);
    const [b] = await tx
      .select()
      .from(bookings)
      .where(eq(bookings.id, input.bookingId))
      .for("update");
    if (!b || (!input.isAdmin && b.userId !== input.actorId))
      throw new UserError("Rezervace nenalezena.");
    if (b.status === "cancelled") throw new UserError("Rezervace už je zrušená.");
    const s = await lockSession(tx, b.sessionId);
    if (!input.isAdmin && s.startsAt <= now)
      throw new UserError("Lekce už začala, rezervaci nelze zrušit.");
    if (!input.isAdmin && (b.status === "attended" || b.status === "no_show"))
      throw new UserError("Rezervaci už nelze zrušit.");

    const late = isLateCancel(s, await cancellationHoursFor(tx, s, cfg), now);
    let refunded = false;

    if (b.status === "pending_payment" && b.orderId) {
      await tx
        .update(orders)
        .set({ status: "cancelled" })
        .where(and(eq(orders.id, b.orderId), eq(orders.status, "pending")));
    } else if (b.status !== "waitlist") {
      refunded = input.isAdmin ? (input.refund ?? true) : !late;
      if (refunded) await refund(tx, b, s, "Storno rezervace");
    }

    await tx
      .update(bookings)
      .set({
        status: "cancelled",
        cancelledAt: now,
        lateCancel: b.status === "confirmed" && late && !refunded,
      })
      .where(eq(bookings.id, b.id));
    if (refunded) await passIncludedOn(tx, b, s);

    const promoted =
      b.status === "waitlist" ? [] : await promoteWaitlist(tx, s, now);
    return { booking: b, session: s, refunded, late, promoted };
  });
}

/**
 * Staff keeps spots on a class for themselves (e.g. 10 places for their own guests).
 * Setting the same session again changes the number; 0 releases the spots
 * and lets the waitlist move up.
 */
export async function holdSeats(
  db: DB,
  input: { sessionId: string; userId: string; seats: number; note?: string },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const s = await lockSession(tx, input.sessionId);
    if (s.status === "cancelled") throw new UserError("Lekce je zrušená.");
    const seats = Math.floor(input.seats);
    if (!(seats >= 0) || seats > 200) throw new UserError("Zadej počet míst.");
    const existing = await activeBooking(tx, input.userId, s.id);
    if (existing && !existing.isHold)
      throw new UserError("Na lekci už jsi přihlášená jako klientka – zruš tu rezervaci, nebo místa drž přes jiný účet.");
    const note = input.note?.trim().slice(0, 80) || null;

    if (seats === 0) {
      if (!existing) throw new UserError("Na téhle lekci žádná místa nedržíš.");
      await tx.update(bookings).set({ status: "cancelled", cancelledAt: now }).where(eq(bookings.id, existing.id));
      const promoted = await promoteWaitlist(tx, s, now);
      return { booking: null, promoted };
    }

    const free = s.capacity - ((await occupancy(tx, s.id)) - (existing?.seats ?? 0));
    if (seats > free)
      throw new UserError(free > 0 ? `Volných míst je jen ${free}.` : "Lekce je plná.");

    let booking: Booking;
    if (existing) {
      [booking] = await tx.update(bookings).set({ seats, guestName: note }).where(eq(bookings.id, existing.id)).returning();
    } else {
      [booking] = await tx
        .insert(bookings)
        .values({ userId: input.userId, sessionId: s.id, status: "confirmed", method: "admin", seats, guestName: note, isHold: true })
        .returning();
    }
    // fewer spots held than before → others on the waitlist can move up
    const promoted = existing && existing.seats > seats ? await promoteWaitlist(tx, s, now) : [];
    return { booking, promoted };
  });
}

/** Studio cancels a class – everyone gets their entry back. */
export async function cancelSession(db: DB, sessionId: string, now = new Date()) {
  return db.transaction(async (tx) => {
    const s = await lockSession(tx, sessionId);
    if (s.status === "cancelled") throw new UserError("Lekce už je zrušená.");
    await tx
      .update(classSessions)
      .set({ status: "cancelled" })
      .where(eq(classSessions.id, s.id));

    const affected = await tx
      .select()
      .from(bookings)
      .where(and(eq(bookings.sessionId, s.id), ne(bookings.status, "cancelled")))
      .for("update");
    for (const b of affected) {
      if (b.status === "pending_payment" && b.orderId) {
        await tx
          .update(orders)
          .set({ status: "cancelled" })
          .where(and(eq(orders.id, b.orderId), eq(orders.status, "pending")));
      } else if (b.status !== "waitlist") {
        await refund(tx, b, s, "Lekce zrušena studiem");
      }
      await tx
        .update(bookings)
        .set({ status: "cancelled", cancelledAt: now })
        .where(eq(bookings.id, b.id));
    }
    return { session: s, affected };
  });
}

/** Reception adds a client – may overbook. `auto` charges like a normal booking. */
/** How reception pays for a booking it makes: pick automatically, don't charge, or a chosen option. */
export type AdminPay = "auto" | "admin" | { method: Method; entitlementId?: string };

export async function adminAddBooking(
  db: DB,
  input: {
    sessionId: string;
    userId: string;
    /** @deprecated use `pay` */
    mode?: "auto" | "admin";
    pay?: AdminPay;
    /** A friend coming along (+1) – takes a second spot and is charged too. */
    guestName?: string;
  },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const s = await lockSession(tx, input.sessionId);
    if (s.status === "cancelled") throw new UserError("Lekce je zrušená.");
    const existing = await activeBooking(tx, input.userId, s.id);
    if (existing && existing.status !== "waitlist")
      throw new UserError("Klient už je na lekci přihlášen.");
    const guestName = input.guestName?.trim().slice(0, 80) || null;
    const seats = guestName ? 2 : 1;
    if (guestName && !guestAllowed(s)) throw new UserError("Na individuální lekci kamarádku přidat nejde.");

    const pay = input.pay ?? input.mode ?? "auto";
    let method: Method = "admin";
    let entitlementId: string | undefined;
    if (pay === "auto") {
      const opt = autoOption(await bookingOptions(tx, input.userId, s, seats));
      if (!opt)
        throw new UserError(
          guestName
            ? "Klient nemá čím zaplatit za dva (permanentka, vstupy zdarma nebo kredit)."
            : "Klient nemá čím zaplatit (kredit, permanentku ani členství).",
        );
      method = opt.method;
      entitlementId = opt.entitlementId;
    } else if (pay !== "admin") {
      if (pay.method === "drop_in" || pay.method === "admin") throw new UserError("Vyber, z čeho se má strhnout.");
      if (pay.method === "free_class" && !s.isFree) throw new UserError("Tahle lekce není zdarma.");
      method = pay.method;
      entitlementId = pay.entitlementId;
    }

    if (existing) {
      await tx
        .update(bookings)
        .set({ status: "cancelled", cancelledAt: now })
        .where(eq(bookings.id, existing.id));
    }
    const [booking] = await tx
      .insert(bookings)
      .values({ userId: input.userId, sessionId: s.id, status: "confirmed", method, guestName, seats })
      .returning();
    await charge(tx, booking, s, method, entitlementId);
    return booking;
  });
}

export async function setAttendance(
  db: DB,
  bookingId: string,
  status: "attended" | "no_show" | "confirmed",
) {
  const [b] = await db
    .update(bookings)
    .set({ status })
    .where(
      and(
        eq(bookings.id, bookingId),
        inArray(bookings.status, ["confirmed", "attended", "no_show"]),
      ),
    )
    .returning();
  if (!b) throw new UserError("Rezervaci nelze upravit.");
  return b;
}

/** Everything the session detail page needs about one client and one class. */
export async function sessionForUser(
  db: DB,
  sessionId: string,
  userId: string | null,
  now = new Date(),
  /** 2 = the client wants to bring a friend (+1) */
  seats = 1,
) {
  const cfg = await getSettings(db);
  const [s] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, sessionId));
  if (!s) return null;
  const occupied = await occupancy(db, s.id);
  const cancellationHours = await cancellationHoursFor(db, s, cfg);
  const window = (await viewerWindows(db, cfg, userId, now)).forSession(s);
  const cap = await capacityFor(db, s, userId, now);
  const state = sessionState({ ...s, capacity: cap.capacity }, occupied, cfg, now, window);
  // +1 only for group classes with two spots left
  const canBringFriend = guestAllowed(s) && cap.capacity - occupied >= 2;
  const withFriend = seats > 1 && canBringFriend;

  let myBooking: Booking | undefined;
  let waitlistPosition: number | null = null;
  let options: BookingOption[] = [];
  if (userId) {
    myBooking = await activeBooking(db, userId, s.id);
    if (myBooking?.status === "waitlist") {
      const queue = await waitlistQueue(db, s);
      waitlistPosition = queue.findIndex((b) => b.id === myBooking!.id) + 1 || null;
    }
    if (state === "bookable" && (!myBooking || myBooking.status === "waitlist"))
      options = await bookingOptions(db, userId, s, withFriend ? 2 : 1);
  }
  return {
    session: s,
    occupied,
    state,
    canBringFriend,
    withFriend,
    myBooking,
    waitlistPosition,
    options,
    lateCancel: isLateCancel(s, cancellationHours, now),
    cancellationHours,
    /** a member sees it full while the last place is kept for non-members – until then */
    heldForOthersUntil: cap.held > 0 && occupied < s.capacity ? cap.releaseAt : null,
    cfg,
    /** not_open: when this viewer can book; members' earlier start when they have a longer window */
    opensAt: bookingOpensAt(s, window),
    memberOpensAt:
      s.bookingOpensAt || sameWindow(windowOf(cfg, true), windowOf(cfg, false)) ? null : bookingOpensAt(s, windowOf(cfg, true)),
    isMemberWindow: !sameWindow(windowOf(cfg, true), windowOf(cfg, false)) && sameWindow(window, windowOf(cfg, true)),
  };
}
