import type { ClassType, Product } from "@/db/schema";
import { dateKey, formatDate, pragueLocalToDate } from "./dates";

/**
 * Price lists by year: a product can be on sale from / until a date (e.g.
 * „Členství 2026“ until 1. 1. 2027, the 2027 one from then on), and a class
 * can change its member surcharge from a date. The price list page shows the
 * current year and – once something is priced for it – the next one.
 */

/** In presale: bought already now, it starts when its price list does („Platí od 1. 1. 2027“). */
export const inPresale = (p: Pick<Product, "saleFrom" | "presaleFrom">, at = new Date()) =>
  !!p.saleFrom && p.saleFrom > at && !!p.presaleFrom && p.presaleFrom <= at;

/** Can be bought at this moment: in the price list and within its sale dates (or in presale). */
export const onSale = (p: Pick<Product, "isActive" | "saleFrom" | "saleUntil" | "presaleFrom">, at = new Date()) =>
  p.isActive && (!p.saleFrom || p.saleFrom <= at || inPresale(p, at)) && (!p.saleUntil || p.saleUntil > at);

/** Not on sale yet, but will be – "V prodeji od 1. 1. 2027". */
export const saleStartsLater = (p: Pick<Product, "saleFrom" | "presaleFrom">, at = new Date()) =>
  !!p.saleFrom && p.saleFrom > at && !inPresale(p, at);

/** A limited membership's places left, said so it moves people: „Zbývají už jen 3 volná členství“ (a pass: „volná místa“). */
export function placesLeftLabel(n: number, pass = false) {
  if (n === 1) return pass ? "Zbývá už jen 1 volné místo" : "Zbývá už jen 1 volné členství";
  if (n >= 2 && n <= 4) return pass ? `Zbývají už jen ${n} volná místa` : `Zbývají už jen ${n} volná členství`;
  return pass ? `Zbývá ještě ${n} volných míst` : `Zbývá ještě ${n} volných členství`;
}

/** When what the product gives starts: now, or the start of its price list when bought in presale. */
export const startsAt = (p: Pick<Product, "saleFrom">, now = new Date()) => (p.saleFrom && p.saleFrom > now ? p.saleFrom : now);

export const yearStart = (y: number) => pragueLocalToDate(`${y}-01-01T00:00`);
const yearOf = (d: Date) => +dateKey(d).slice(0, 4);

/** Price lists to show: this year, and the next one once a product or a price is set for it. */
export function priceListYears(list: Product[], types: Pick<ClassType, "memberSurchargeNextFrom">[], now = new Date()) {
  const y = yearOf(now);
  const next = yearStart(y + 1);
  const hasNext =
    list.some((p) => (p.saleFrom && p.saleFrom >= next) || (p.saleUntil && p.saleUntil > now && p.saleUntil <= next)) ||
    types.some((t) => t.memberSurchargeNextFrom?.startsWith(String(y + 1)));
  return hasNext ? [y, y + 1] : [y];
}

/** When a year's price list starts counting: now for this year, 1 January for a later one. */
export const priceListStart = (year: number, now = new Date()) => (year <= yearOf(now) ? now : yearStart(year));

/** Products of a year's price list – on sale at some point between its start and the end of the year. */
export function productsForYear<P extends Pick<Product, "saleFrom" | "saleUntil">>(list: P[], year: number, now = new Date()) {
  const from = priceListStart(year, now);
  const to = yearStart(year + 1);
  return list.filter((p) => (!p.saleUntil || p.saleUntil > from) && (!p.saleFrom || p.saleFrom < to));
}

type SurchargeRules = Pick<ClassType, "memberSurcharge" | "memberSurchargeFrom" | "memberSurchargeNext" | "memberSurchargeNextFrom">;

/** Members' surcharge for a class on a day ("YYYY-MM-DD"): the next price once it starts, else the current one from its start. */
export function surchargeOn(t: SurchargeRules, day: string) {
  if (t.memberSurchargeNext !== null && t.memberSurchargeNextFrom && day >= t.memberSurchargeNextFrom) return t.memberSurchargeNext;
  if (!t.memberSurcharge) return 0;
  if (t.memberSurchargeFrom && day < t.memberSurchargeFrom) return 0;
  return t.memberSurcharge;
}

type PriceRules = Pick<ClassType, "dropInPrice" | "creditCost" | "dropInPriceNext" | "creditCostNext" | "memberSurchargeNextFrom">;

/** A class's drop-in price and credit cost on a day ("YYYY-MM-DD"): the next price list's once it starts. */
export function priceOn(t: PriceRules, day: string) {
  const next = !!t.memberSurchargeNextFrom && day >= t.memberSurchargeNextFrom;
  return {
    dropInPrice: next && t.dropInPriceNext !== null ? t.dropInPriceNext : t.dropInPrice,
    creditCost: next && t.creditCostNext !== null ? t.creditCostNext : t.creditCost,
  };
}

/**
 * A new session's price: one left as the class has it today follows the price list of
 * the session's day (Reformer added in December for January costs the January price);
 * a price typed in by hand stays.
 */
export function sessionPriceOn(t: PriceRules, entered: { creditCost: number; dropInPrice: number | null }, day: string, today: string) {
  const now = priceOn(t, today);
  const then = priceOn(t, day);
  return {
    creditCost: entered.creditCost === now.creditCost ? then.creditCost : entered.creditCost,
    dropInPrice: entered.dropInPrice !== null && entered.dropInPrice === now.dropInPrice ? then.dropInPrice : entered.dropInPrice,
  };
}

type PassRules = Pick<ClassType, "passEntries" | "passSurcharge" | "passEntriesNext" | "passSurchargeNext" | "memberSurchargeNextFrom">;

/** What a pass takes for a class on a day: entries and the surcharge on top (null = none) – the next price list's once it starts. */
export function passOn(t: PassRules, day: string) {
  const next = !!t.memberSurchargeNextFrom && day >= t.memberSurchargeNextFrom;
  return {
    passEntries: next && t.passEntriesNext !== null ? t.passEntriesNext : t.passEntries,
    passSurcharge: next && t.passSurchargeNext !== null ? t.passSurchargeNext || null : t.passSurcharge,
  };
}

/** The class as it is priced on that day – for pages that show a price list or today's prices. */
export const typeOn = <T extends PriceRules & PassRules>(t: T, day: string): T => ({ ...t, ...priceOn(t, day), ...passOn(t, day) });

/** The price for two is a discount – shown and charged only when cheaper than two entries on their own. */
export const duoSaves = (t: Pick<ClassType, "duoPrice" | "dropInPrice">) =>
  t.duoPrice !== null && t.dropInPrice !== null && t.duoPrice < 2 * t.dropInPrice;

/** Members' surcharge within a price list period: the one at its start and changes later in it ("od 1. 11. 2026"). */
export function surchargeSteps(t: SurchargeRules, from: Date, to: Date) {
  const start = dateKey(from);
  const end = dateKey(to);
  const steps: { amount: number; from: string | null }[] = [];
  const first = surchargeOn(t, start);
  if (first > 0) steps.push({ amount: first, from: null });
  let last = first;
  for (const d of [t.memberSurchargeFrom, t.memberSurchargeNextFrom].filter((d): d is string => !!d && d > start && d < end).sort()) {
    const amount = surchargeOn(t, d);
    if (amount !== last && amount > 0) steps.push({ amount, from: d });
    last = amount;
  }
  return steps;
}

/** "2026-11-01" → "1. 11. 2026" */
export const dayLabel = (day: string) => formatDate(pragueLocalToDate(`${day}T12:00`));

/** The class's price note (e.g. „Zaváděcí cena pro rok 2026“) if it still applies on that day. */
export const priceNoteOn = (t: Pick<ClassType, "priceNote" | "priceNoteUntil">, day: string) =>
  t.priceNote && (!t.priceNoteUntil || day < t.priceNoteUntil) ? t.priceNote : "";
