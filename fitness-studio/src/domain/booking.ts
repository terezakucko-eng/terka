import { and, asc, count, eq, gte, inArray, lt, lte, ne, gt } from "drizzle-orm";
import type { DB, Executor } from "@/db";
import {
  bookings,
  classSessions,
  entitlements,
  orders,
  users,
  type Booking,
  type ClassSession,
  type Entitlement,
} from "@/db/schema";
import { weekRange } from "@/lib/dates";
import { UserError } from "@/lib/errors";
import { credits as creditsLabel, formatPrice } from "@/lib/money";
import { getSettings, type Settings } from "@/lib/settings";
import { changeCredits } from "./wallet";

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

export function sessionState(
  s: ClassSession,
  occupied: number,
  cfg: Settings,
  now: Date,
): SessionState {
  if (s.status === "cancelled") return "cancelled";
  if (s.startsAt <= now) return "past";
  if (s.startsAt.getTime() - cfg.bookingCutoffMinutes * MIN <= now.getTime())
    return "closed";
  if (s.startsAt.getTime() > now.getTime() + cfg.bookingWindowDays * DAY)
    return "not_open";
  if (occupied >= s.capacity) return "full";
  return "bookable";
}

export function isLateCancel(s: ClassSession, cfg: Settings, now: Date) {
  return now.getTime() > s.startsAt.getTime() - cfg.cancellationHours * HOUR;
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

export async function occupancy(tx: Executor, sessionId: string) {
  const [r] = await tx
    .select({ n: count() })
    .from(bookings)
    .where(
      and(
        eq(bookings.sessionId, sessionId),
        inArray(bookings.status, [...OCCUPYING]),
      ),
    );
  return r.n;
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
async function entitlementProblem(
  tx: Executor,
  e: Entitlement,
  s: ClassSession,
): Promise<string | null> {
  if (e.status !== "active") return "Oprávnění není aktivní.";
  if (e.validFrom > s.startsAt || e.validUntil <= s.startsAt)
    return "Na datum lekce už neplatí.";
  if (e.entriesTotal !== null && e.entriesUsed >= e.entriesTotal)
    return "Vyčerpané vstupy.";
  if (e.weeklyLimit !== null) {
    const used = await weeklyUsage(tx, e.id, s);
    if (used >= e.weeklyLimit)
      return `Týdenní limit ${e.weeklyLimit} lekcí je vyčerpán.`;
  }
  return null;
}

const methodForKind = {
  membership: "membership",
  pass: "pass",
  free: "free",
} as const satisfies Record<Entitlement["kind"], Method>;

/** All ways the client could pay for the session, best first. */
export async function bookingOptions(
  tx: Executor,
  userId: string,
  s: ClassSession,
): Promise<BookingOption[]> {
  if (s.isFree) {
    return [
      {
        method: "free_class",
        label: "Lekce zdarma",
        detail: "Tahle lekce je pro všechny zdarma.",
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
        lte(entitlements.validFrom, s.startsAt),
        gt(entitlements.validUntil, s.startsAt),
      ),
    )
    .orderBy(asc(entitlements.validUntil));

  const rank = { membership: 0, pass: 1, free: 2 };
  ents.sort((a, b) => rank[a.kind] - rank[b.kind]);
  for (const e of ents) {
    const problem = await entitlementProblem(tx, e, s);
    const left =
      e.entriesTotal === null
        ? "neomezeně"
        : `zbývá ${e.entriesTotal - e.entriesUsed} z ${e.entriesTotal}`;
    opts.push({
      method: methodForKind[e.kind],
      entitlementId: e.id,
      label: e.name,
      detail: left,
      ...(problem ? { disabled: problem } : {}),
    });
  }

  const [u] = await tx
    .select({ balance: users.creditBalance })
    .from(users)
    .where(eq(users.id, userId));
  const balance = u?.balance ?? 0;
  opts.push({
    method: "credits",
    label: `Zaplatit kreditem (${creditsLabel(s.creditCost)})`,
    detail: `Na účtu máš ${creditsLabel(balance)}.`,
    ...(balance < s.creditCost ? { disabled: "Nedostatek kreditu." } : {}),
  });

  if (s.dropInPrice !== null) {
    opts.push({
      method: "drop_in",
      label: `Jednorázový vstup ${formatPrice(s.dropInPrice)}`,
      detail: "Zaplatíš online kartou.",
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
  let entId: string | null = null;

  switch (method) {
    case "free_class":
      if (!s.isFree) throw new UserError("Tahle lekce není zdarma.");
      break;
    case "credits":
      await changeCredits(tx, {
        userId: booking.userId,
        delta: -s.creditCost,
        reason: "booking",
        bookingId: booking.id,
      });
      creditsCharged = s.creditCost;
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
      if (!e || e.userId !== booking.userId || methodForKind[e.kind] !== method)
        throw new UserError("Permanentka nenalezena.");
      const problem = await entitlementProblem(tx, e, s);
      if (problem) throw new UserError(problem);
      if (e.entriesTotal !== null) {
        await tx
          .update(entitlements)
          .set({ entriesUsed: e.entriesUsed + 1 })
          .where(eq(entitlements.id, e.id));
      }
      entId = e.id;
      break;
    }
    case "admin":
      break;
    case "drop_in":
      throw new Error("drop_in is charged through an order");
  }

  await tx
    .update(bookings)
    .set({ creditsCharged, entitlementId: entId, method })
    .where(eq(bookings.id, booking.id));
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
    case "drop_in":
      // Online payments come back as credit – no card round-trip needed.
      await changeCredits(tx, {
        userId: b.userId,
        delta: s.creditCost,
        reason: "refund",
        bookingId: b.id,
        note: `${note} (jednorázový vstup vrácen jako kredit)`,
      });
      break;
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
        await tx
          .update(entitlements)
          .set({ entriesUsed: e.entriesUsed - 1 })
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
};

export async function bookSession(db: DB, input: BookInput, now = new Date()) {
  return db.transaction(async (tx) => {
    const cfg = await getSettings(tx);
    const s = await lockSession(tx, input.sessionId);
    await expireStalePending(tx, now, s.id);

    const state = sessionState(s, await occupancy(tx, s.id), cfg, now);
    if (state === "full")
      throw new UserError("Lekce je plná – můžeš se zapsat do pořadníku.");
    if (state !== "bookable") throw new UserError(stateMessage[state]);
    if (input.method === "admin") throw new UserError("Nepovolená platba.");
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
      if (s.dropInPrice === null)
        throw new UserError("Na tuto lekci nelze koupit jednorázový vstup.");
      const [order] = await tx
        .insert(orders)
        .values({
          userId: input.userId,
          kind: "drop_in",
          sessionId: s.id,
          description: "Jednorázový vstup",
          amount: s.dropInPrice,
          provider: "pending",
          expiresAt: new Date(now.getTime() + cfg.pendingPaymentMinutes * MIN),
        })
        .returning();
      const [booking] = await tx
        .insert(bookings)
        .values({
          userId: input.userId,
          sessionId: s.id,
          status: "pending_payment",
          method: "drop_in",
          orderId: order.id,
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
    const state = sessionState(s, await occupancy(tx, s.id), cfg, now);
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

/** Fills free spots from the waitlist, charging each client automatically. */
async function promoteWaitlist(tx: Executor, s: ClassSession, now: Date) {
  const promoted: Booking[] = [];
  if (s.status !== "scheduled" || s.startsAt <= now) return promoted;

  const waiting = await tx
    .select()
    .from(bookings)
    .where(and(eq(bookings.sessionId, s.id), eq(bookings.status, "waitlist")))
    .orderBy(asc(bookings.createdAt));

  let free = s.capacity - (await occupancy(tx, s.id));
  for (const w of waiting) {
    if (free <= 0) break;
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

    const late = isLateCancel(s, cfg, now);
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

    const promoted =
      b.status === "waitlist" ? [] : await promoteWaitlist(tx, s, now);
    return { booking: b, session: s, refunded, late, promoted };
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
export async function adminAddBooking(
  db: DB,
  input: { sessionId: string; userId: string; mode: "auto" | "admin" },
  now = new Date(),
) {
  return db.transaction(async (tx) => {
    const s = await lockSession(tx, input.sessionId);
    if (s.status === "cancelled") throw new UserError("Lekce je zrušená.");
    const existing = await activeBooking(tx, input.userId, s.id);
    if (existing && existing.status !== "waitlist")
      throw new UserError("Klient už je na lekci přihlášen.");

    let method: Method = "admin";
    let entitlementId: string | undefined;
    if (input.mode === "auto") {
      const opt = autoOption(await bookingOptions(tx, input.userId, s));
      if (!opt)
        throw new UserError(
          "Klient nemá čím zaplatit (kredit, permanentku ani členství).",
        );
      method = opt.method;
      entitlementId = opt.entitlementId;
    }

    if (existing) {
      await tx
        .update(bookings)
        .set({ status: "cancelled", cancelledAt: now })
        .where(eq(bookings.id, existing.id));
    }
    const [booking] = await tx
      .insert(bookings)
      .values({ userId: input.userId, sessionId: s.id, status: "confirmed", method })
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
) {
  const cfg = await getSettings(db);
  const [s] = await db
    .select()
    .from(classSessions)
    .where(eq(classSessions.id, sessionId));
  if (!s) return null;
  const occupied = await occupancy(db, s.id);
  const state = sessionState(s, occupied, cfg, now);

  let myBooking: Booking | undefined;
  let waitlistPosition: number | null = null;
  let options: BookingOption[] = [];
  if (userId) {
    myBooking = await activeBooking(db, userId, s.id);
    if (myBooking?.status === "waitlist") {
      const [r] = await db
        .select({ n: count() })
        .from(bookings)
        .where(
          and(
            eq(bookings.sessionId, s.id),
            eq(bookings.status, "waitlist"),
            lte(bookings.createdAt, myBooking.createdAt),
          ),
        );
      waitlistPosition = r.n;
    }
    if (state === "bookable" && (!myBooking || myBooking.status === "waitlist"))
      options = await bookingOptions(db, userId, s);
  }
  return {
    session: s,
    occupied,
    state,
    myBooking,
    waitlistPosition,
    options,
    lateCancel: isLateCancel(s, cfg, now),
    cfg,
  };
}
