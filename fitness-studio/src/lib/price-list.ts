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
