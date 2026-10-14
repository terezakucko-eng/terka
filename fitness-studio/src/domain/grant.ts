import type { Executor } from "@/db";
import { entitlements, type Product } from "@/db/schema";
import { startsAt } from "@/lib/price-list";
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
        validUntil: periodEnd ?? new Date(from.getTime() + (p.validityDays ?? 30) * DAY),
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
