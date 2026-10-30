import { and, asc, desc, eq, gte, inArray, isNull, lte, ne, or, sql } from "drizzle-orm";
import type { Executor } from "@/db";
import { classTypes, earlyBookings, entitlements, orders, products, users } from "@/db/schema";
import { pragueLocalToDate } from "@/lib/dates";

/**
 * Dárek za včasnou rezervaci: a new membership with commitment signed up for 2027 in time – starting
 * from 1. 11. 2026 or reserved in presale for 1. 1. 2027 (Členství Reformer too) – brings 4 Reformer
 * fusion lessons without the members' surcharge for the whole of 2027. Signed up by 30. 11., Fitness
 * Ježíšek brings a gift in December. Memberships running from before, or from January on, don't count.
 */
export const EARLY_BIRD = {
  entries: 4,
  name: "Reformer bez doplatku 2027",
  note: "Dárek za včasnou rezervaci členství na rok 2027",
  /** a new membership starting from this day… */
  startsFrom: pragueLocalToDate("2026-11-01T00:00"),
  /** …to the start of 2027, when the lessons start to be valid… */
  from: pragueLocalToDate("2027-01-01T00:00"),
  /** …to the end of the year */
  until: pragueLocalToDate("2028-01-01T00:00"),
  /** signed up before this, Fitness Ježíšek brings a gift */
  santaBefore: pragueLocalToDate("2026-12-01T00:00"),
  classSlug: "reformer-fusion",
};

/** A membership bought now starting then has the gift coming (price list cards). */
export const startsInTime = (start: Date) => start >= EARLY_BIRD.startsFrom && start <= EARLY_BIRD.from;

/** Fitness Ježíšek: signed up by the end of November. */
export const santaComing = (signedUpAt: Date) => signedUpAt < EARLY_BIRD.santaBefore;

/**
 * Records who signed up in time and gives them the 4 lessons (these clients, or all who have it coming),
 * once each. Signed up = when they ordered, or when the studio set the membership up. Returns how many are new.
 */
export async function grantEarlyBirdGift(tx: Executor, userIds?: string[]) {
  if (userIds && !userIds.length) return 0;
  const signedUp = sql<Date>`coalesce(${orders.createdAt}, ${entitlements.createdAt})`.mapWith(entitlements.createdAt);
  const rows = await tx
    .select({ userId: entitlements.userId, membershipId: entitlements.id, signedUpAt: signedUp })
    .from(entitlements)
    .leftJoin(products, eq(entitlements.productId, products.id))
    .leftJoin(orders, eq(entitlements.orderId, orders.id))
    .leftJoin(earlyBookings, eq(earlyBookings.userId, entitlements.userId))
    .where(
      and(
        userIds ? inArray(entitlements.userId, userIds) : undefined,
        isNull(earlyBookings.id),
        eq(entitlements.kind, "membership"),
        eq(entitlements.status, "active"),
        gte(entitlements.validFrom, EARLY_BIRD.startsFrom),
        lte(entitlements.validFrom, EARLY_BIRD.from),
        // with commitment (a membership set by the studio counts as one)
        or(isNull(products.id), ne(products.commitmentMonths, 0)),
      ),
    )
    .orderBy(asc(signedUp));
  // the earliest sign-up of each client
  const first = new Map<string, (typeof rows)[number]>();
  for (const r of rows) if (!first.has(r.userId)) first.set(r.userId, r);
  if (!first.size) return 0;
  const [ct] = await tx.select({ id: classTypes.id }).from(classTypes).where(eq(classTypes.slug, EARLY_BIRD.classSlug));
  for (const r of first.values()) {
    const [had] = await tx
      .select({ id: entitlements.id })
      .from(entitlements)
      .where(and(eq(entitlements.userId, r.userId), eq(entitlements.kind, "free"), eq(entitlements.name, EARLY_BIRD.name)));
    const gift =
      had ??
      (ct
        ? (
            await tx
              .insert(entitlements)
              .values({
                userId: r.userId,
                kind: "free",
                name: EARLY_BIRD.name,
                entriesTotal: EARLY_BIRD.entries,
                classTypeId: ct.id,
                validFrom: EARLY_BIRD.from,
                validUntil: EARLY_BIRD.until,
                note: EARLY_BIRD.note,
              })
              .returning({ id: entitlements.id })
          )[0]
        : undefined);
    await tx
      .insert(earlyBookings)
      .values({ userId: r.userId, membershipId: r.membershipId, signedUpAt: r.signedUpAt, giftId: gift?.id ?? null })
      .onConflictDoNothing();
  }
  return first.size;
}

/** Admin → Dárky členům: who signed up in time, Fitness Ježíšek's ones first, earliest first. */
export async function earlyBookingList(db: Executor) {
  const rows = await db
    .select({
      b: earlyBookings,
      name: users.name,
      email: users.email,
      membership: sql<string | null>`(select ${entitlements.name} from ${entitlements} where ${entitlements.id} = ${earlyBookings.membershipId})`,
      used: sql<number | null>`(select ${entitlements.entriesUsed} from ${entitlements} where ${entitlements.id} = ${earlyBookings.giftId})`,
    })
    .from(earlyBookings)
    .innerJoin(users, eq(earlyBookings.userId, users.id))
    .orderBy(asc(earlyBookings.signedUpAt), desc(earlyBookings.createdAt));
  return rows.map((r) => ({ ...r, santa: santaComing(r.b.signedUpAt) }));
}

/** Admin: Fitness Ježíšek's gift handed over (or not after all). */
export async function markSantaGiven(db: Executor, id: string, given: boolean, now = new Date()) {
  await db.update(earlyBookings).set({ santaGivenAt: given ? now : null }).where(eq(earlyBookings.id, id));
}
