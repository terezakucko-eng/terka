import type { Product } from "@/db/schema";
import { startsAt } from "@/lib/price-list";
import { VACATION } from "@/lib/vacation";
import { EARLY_BIRD, startsInTime } from "./early-bird";

/**
 * What a membership with commitment brings on top (price list cards): bought now to start in time,
 * Fitness Ježíšek (by 30. 11.) and the early-booking gift; always Zmražení členství.
 */
export function memberRewardNotes(p: Pick<Product, "kind" | "commitmentMonths" | "saleFrom">, now: Date) {
  if (p.kind !== "membership" || p.commitmentMonths === 0) return [];
  const inTime = startsInTime(startsAt(p, now));
  return [
    ...(inTime && now < EARLY_BIRD.santaBefore ? ["🎅 Přihlas se do 30. 11. a v prosinci tě navštíví Fitness Ježíšek s dárkem"] : []),
    ...(inTime && now < EARLY_BIRD.from ? [`🎁 Dárek za včasnou rezervaci: ${EARLY_BIRD.entries}× Reformer v roce 2027 bez doplatku`] : []),
    `❄️ Zmražení členství${now < VACATION.from ? " (od 1. 1. 2027)" : ""}: ${VACATION.perYear}× ročně týden zdarma – dovolená, nemoc…`,
  ];
}
