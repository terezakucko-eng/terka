import type { Product } from "@/db/schema";
import { EARLY_BIRD } from "./early-bird";
import { VACATION } from "./vacations";

/** What a membership with commitment brings on top (price list cards): Program Dovolená and, until 2027, the early-booking gift. */
export function memberRewardNotes(p: Pick<Product, "kind" | "commitmentMonths" | "includedPerMonth">, now: Date) {
  if (p.kind !== "membership" || p.commitmentMonths === 0) return [];
  return [
    ...(now < EARLY_BIRD.from && p.includedPerMonth === 0
      ? [`🎁 Dárek za rezervaci do 31. 12. 2026: ${EARLY_BIRD.entries}× Reformer v roce 2027 bez doplatku`]
      : []),
    `🏖️ Program Dovolená${now < VACATION.from ? " (od 1. 1. 2027)" : ""}: ${VACATION.perYear}× ročně týden pryč – ten týden nezaplatíš`,
  ];
}
