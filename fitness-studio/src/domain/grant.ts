import { and, eq, isNull } from "drizzle-orm";
import type { Executor } from "@/db";
import { entitlements, type Product } from "@/db/schema";
import { addDays, dateKey, pragueLocalToDate } from "@/lib/dates";
import { startsAt } from "@/lib/price-list";
import { grantEarlyBirdGift } from "./early-bird";
import { changeCredits, extendCreditValidity } from "./wallet";

const DAY = 86_400_000;
/** A membership paid once lasts a year. */
export const MEMBERSHIP_DAYS = 365;
/** Note on a membership ordered in presale and paid later, by the first monthly fee request. */
export const PRESALE_RESERVED = "Předprodej – první měsíc zaplatí výzvou v prosinci";

/**
 * Creates whatever the product grants – bought (the order) or received as a
 * gift voucher (no order, a note says which voucher).
 */
export async function grantProduct(
  tx: Executor,
  /** reserved: ordered in presale, paid later by monthly fee requests (no order) */
  to: { userId: string; orderId: string | null; subscriptionId?: string | null; note?: string; reserved?: boolean },
  p: Product,
  now: Date,
  periodEnd?: Date,
) {
  switch (p.kind) {
    case "credit_pack":
      await changeCredits(tx, {
        userId: to.userId,
        delta: p.credits ?? 0,
        reason: "purchase",
        orderId: to.orderId,
        note: to.note ? `${p.name} – ${to.note}` : p.name,
      });
      if (p.validityDays) await extendCreditValidity(tx, to.userId, p.validityDays, now);
      return;
    case "pass":
    case "membership":
    case "solarium":
    case "massage_pass": {
      // bought in presale (Členství 2027 in December) it starts on 1 January
      const from = startsAt(p, now);
      // a membership paid once (transfer, presale, reception – not a card subscription) runs 365 days, to 23:59
      // of the last one, with or without commitment (that one ends whenever she likes): the purchase pays the
      // first month, monthly fee requests the rest
      const yearEnd =
        p.kind === "membership" && (to.orderId || to.reserved) && !to.subscriptionId && !periodEnd
          ? new Date(pragueLocalToDate(`${addDays(dateKey(from), MEMBERSHIP_DAYS)}T00:00`).getTime() - 60_000)
          : null;
      // paid now for a membership already reserved in presale: the payment covers its first month
      if (p.kind === "membership" && to.orderId) {
        const [reserved] = await tx
          .update(entitlements)
          .set({ orderId: to.orderId, subscriptionId: to.subscriptionId ?? null, note: null })
          .where(and(eq(entitlements.userId, to.userId), eq(entitlements.productId, p.id), eq(entitlements.status, "active"), isNull(entitlements.orderId), eq(entitlements.note, PRESALE_RESERVED)))
          .returning({ id: entitlements.id });
        if (reserved) return;
      }
      await tx.insert(entitlements).values({
        userId: to.userId,
        kind: p.kind,
        productId: p.id,
        orderId: to.orderId,
        name: p.name,
        entriesTotal: p.entries,
        weeklyLimit: p.kind === "membership" ? p.weeklyLimit : null,
        massageServiceId: p.kind === "massage_pass" ? p.massageServiceId : null,
        // a pass just for one class (Permanentka Reformer)
        classTypeId: p.kind === "pass" ? p.classTypeId : null,
        validFrom: from,
        validUntil: periodEnd ?? yearEnd ?? new Date(from.getTime() + (p.validityDays ?? 30) * DAY),
        subscriptionId: to.subscriptionId ?? null,
        // a membership without commitment or with lessons included is billed at its own monthly price
        monthlyFee: p.kind === "membership" && (p.commitmentMonths === 0 || p.includedPerMonth > 0) ? p.price : null,
        includedClassTypeId: p.kind === "membership" ? p.includedClassTypeId : null,
        includedPerMonth: p.kind === "membership" ? p.includedPerMonth : 0,
        note: to.note ?? null,
      });
      // a member for 2027 signed up in time: the early-booking gift (4× Reformer without the surcharge)
      if (p.kind === "membership") await grantEarlyBirdGift(tx, [to.userId]);
      return;
    }
  }
}
