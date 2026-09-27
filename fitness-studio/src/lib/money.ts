const czk = new Intl.NumberFormat("cs-CZ", {
  style: "currency",
  currency: "CZK",
  maximumFractionDigits: 0,
});

/** Amounts are stored in haléře (1/100 Kč). */
export const formatPrice = (halere: number) => czk.format(halere / 100);

export const kcToHalere = (kc: number) => Math.round(kc * 100);

export function pluralCs(n: number, one: string, few: string, many: string) {
  if (n === 1) return `${n} ${one}`;
  if (n >= 2 && n <= 4) return `${n} ${few}`;
  return `${n} ${many}`;
}

export const credits = (n: number) => pluralCs(n, "kredit", "kredity", "kreditů");
export const entries = (n: number) => pluralCs(n, "vstup", "vstupy", "vstupů");

/**
 * Price of one class paid with the cheapest entry pass on offer ("bodová
 * permanentka"): pass price per entry × entries the class takes, rounded to
 * whole Kč. Null when no pass is sold or it wouldn't beat the single entry.
 */
export function passLessonPrice(
  entriesNeeded: number,
  packs: { kind: string; price: number; entries: number | null }[],
  dropIn?: number | null,
): number | null {
  const rates = packs.filter((p) => p.kind === "pass" && p.entries).map((p) => p.price / p.entries!);
  if (!rates.length || entriesNeeded <= 0) return null;
  const price = Math.round((entriesNeeded * Math.min(...rates)) / 100) * 100;
  return dropIn != null && price >= dropIn ? null : price;
}

export const entriesLabel = (n: number) => `${n} ${n === 1 ? "vstup" : n < 5 ? "vstupy" : "vstupů"}`;
