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
 * What `creditCost` credits cost when bought in the cheapest credit pack on
 * offer ("bodová permanentka"), in haléře rounded to whole Kč. Null when no
 * pack is sold, or when it wouldn't be cheaper than the single entry
 * `dropIn` (then the price list is still half set up and the number is noise).
 */
export function creditPackPrice(
  creditCost: number,
  packs: { kind: string; price: number; credits: number | null }[],
  dropIn?: number | null,
): number | null {
  const rates = packs.filter((p) => p.kind === "credit_pack" && p.credits).map((p) => p.price / p.credits!);
  if (!rates.length || creditCost <= 0) return null;
  const price = Math.round((creditCost * Math.min(...rates)) / 100) * 100;
  return dropIn != null && price >= dropIn ? null : price;
}
