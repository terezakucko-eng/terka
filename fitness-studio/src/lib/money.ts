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
