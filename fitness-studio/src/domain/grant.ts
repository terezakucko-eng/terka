import type { Executor } from "@/db";
import { entitlements, type Product } from "@/db/schema";
import { dateKey, pragueLocalToDate } from "@/lib/dates";
import { startsAt } from "@/lib/price-list";
import { shiftPeriod } from "./membership-fees";
import { changeCredits, extendCreditValidity } from "./wallet";

const DAY = 86_400_000;

/**
 * Creates whatever the product grants – bought (the order) or received as a
 * gift voucher (no order, a note says which voucher).
 */
export async function grantProduct(
  tx: Executor,
  to: { userId: string; orderId: string | null; subscriptionId?: string | null; note?: string },
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
      // a membership with commitment paid once (transfer, presale – not a card subscription) runs for the
      // whole commitment: the purchase pays its first month, monthly fee requests the rest (to 23:59 of the last day)
      const commitmentEnd =
        p.kind === "membership" && p.commitmentMonths > 0 && to.orderId && !to.subscriptionId && !periodEnd
          ? new Date(pragueLocalToDate(`${shiftPeriod(dateKey(from).slice(0, 7), p.commitmentMonths)}-01T00:00`).getTime() - 60_000)
          : null;
      await tx.insert(entitlements).values({
        userId: to.userId,
        kind: p.kind,
        productId: p.id,
        orderId: to.orderId,
        name: p.name,
        entriesTotal: p.entries,
        weeklyLimit: p.kind === "membership" ? p.weeklyLimit : null,
        massageServiceId: p.kind === "massage_pass" ? p.massageServiceId : null,
        validFrom: from,
        validUntil: periodEnd ?? commitmentEnd ?? new Date(from.getTime() + (p.validityDays ?? 30) * DAY),
        subscriptionId: to.subscriptionId ?? null,
        // a membership without commitment or with lessons included is billed at its own monthly price
        monthlyFee: p.kind === "membership" && (p.commitmentMonths === 0 || p.includedPerMonth > 0) ? p.price : null,
        includedClassTypeId: p.kind === "membership" ? p.includedClassTypeId : null,
        includedPerMonth: p.kind === "membership" ? p.includedPerMonth : 0,
        note: to.note ?? null,
      });
      return;
    }
  }
}
