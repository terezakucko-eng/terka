import { and, eq, gt, inArray, isNull, lte, ne, or } from "drizzle-orm";
import type { Executor } from "@/db";
import { classTypes, entitlements, products } from "@/db/schema";
import { pragueLocalToDate } from "@/lib/dates";

/**
 * Dárek za včasnou rezervaci: who is a member with commitment on 1 January 2027
 * (signed up by the end of 2026) gets 4 Reformer fusion lessons without the
 * members' surcharge for the whole of 2027. Členství Reformer has Reformer in
 * its price every month, so it doesn't get them; who joins in January neither.
 */
export const EARLY_BIRD = {
  entries: 4,
  name: "Reformer bez doplatku 2027",
  note: "Dárek za včasnou rezervaci členství na rok 2027",
  from: pragueLocalToDate("2027-01-01T00:00"),
  until: pragueLocalToDate("2028-01-01T00:00"),
  classSlug: "reformer-fusion",
};

/** Gives the gift to these clients (all who have it coming when none are given), once each. Returns how many got it. */
export async function grantEarlyBirdGift(tx: Executor, userIds?: string[]) {
  if (userIds && !userIds.length) return 0;
  const [ct] = await tx.select({ id: classTypes.id }).from(classTypes).where(eq(classTypes.slug, EARLY_BIRD.classSlug));
  if (!ct) return 0;
  const members = await tx
    .select({ userId: entitlements.userId })
    .from(entitlements)
    .leftJoin(products, eq(entitlements.productId, products.id))
    .where(
      and(
        userIds ? inArray(entitlements.userId, userIds) : undefined,
        eq(entitlements.kind, "membership"),
        eq(entitlements.status, "active"),
        // a member on 1 January: from then on (or already) and still after
        lte(entitlements.validFrom, EARLY_BIRD.from),
        gt(entitlements.validUntil, EARLY_BIRD.from),
        // not Členství Reformer (lessons included), with commitment (a membership set by the studio counts as one)
        eq(entitlements.includedPerMonth, 0),
        or(isNull(products.id), ne(products.commitmentMonths, 0)),
      ),
    );
  const ids = [...new Set(members.map((m) => m.userId))];
  if (!ids.length) return 0;
  const has = await tx
    .select({ userId: entitlements.userId })
    .from(entitlements)
    .where(and(inArray(entitlements.userId, ids), eq(entitlements.kind, "free"), eq(entitlements.name, EARLY_BIRD.name)));
  const todo = ids.filter((id) => !has.some((h) => h.userId === id));
  if (!todo.length) return 0;
  await tx.insert(entitlements).values(
    todo.map((userId) => ({
      userId,
      kind: "free" as const,
      name: EARLY_BIRD.name,
      entriesTotal: EARLY_BIRD.entries,
      classTypeId: ct.id,
      validFrom: EARLY_BIRD.from,
      validUntil: EARLY_BIRD.until,
      note: EARLY_BIRD.note,
    })),
  );
  return todo.length;
}
