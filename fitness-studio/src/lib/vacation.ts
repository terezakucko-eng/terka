import { addDays, pragueLocalToDate } from "@/lib/dates";
import { formatPrice } from "@/lib/money";

/**
 * Zmražení členství (internally "vacation"): a member with commitment freezes a week twice a
 * year (from 2027) – holiday, illness, anything – can't book classes that week and pays that
 * month less, the week's share of the monthly fee by days.
 */
export const VACATION = {
  /** the first day one can start */
  firstDay: "2027-01-01",
  from: pragueLocalToDate("2027-01-01T00:00"),
  perYear: 2,
  days: 7,
  /** from tomorrow at the earliest – illness can't wait (the studio may set it any time) */
  noticeDays: 1,
};

/** The last day of a vacation starting that day ("YYYY-MM-DD"). */
export const vacationEnd = (startsOn: string) => addDays(startsOn, VACATION.days - 1);

/** "8.–14. 2. 2027", "29. 3. – 4. 4. 2027", "28. 12. 2027 – 3. 1. 2028" */
export function vacationLabel(startsOn: string, endsOn: string) {
  const [y1, m1, d1] = startsOn.split("-").map(Number);
  const [y2, m2, d2] = endsOn.split("-").map(Number);
  if (y1 !== y2) return `${d1}. ${m1}. ${y1} – ${d2}. ${m2}. ${y2}`;
  if (m1 !== m2) return `${d1}. ${m1}. – ${d2}. ${m2}. ${y2}`;
  return `${d1}.–${d2}. ${m2}. ${y2}`;
}

const daysInMonth = (period: string) => new Date(Date.UTC(+period.slice(0, 4), +period.slice(5, 7), 0)).getUTCDate();

/** The vacation's days by month: [{ period: "2027-03", days: 3, of: 31 }, …] */
export function daysByMonth(startsOn: string, endsOn: string) {
  const out: { period: string; days: number; of: number }[] = [];
  for (let d = startsOn; d <= endsOn; d = addDays(d, 1)) {
    const period = d.slice(0, 7);
    const last = out.at(-1);
    if (last?.period === period) last.days++;
    else out.push({ period, days: 1, of: daysInMonth(period) });
  }
  return out;
}

/** The fee's share for those days, in whole crowns (haléře): 1 400 Kč × 7 / 31 → 316 Kč. */
export const daysShare = (fee: number, days: number, of: number) => Math.round((fee * days) / of / 100) * 100;

/** What a fee request says about the discount: " · zmražení 8.–14. 2. 2027 −316 Kč" */
export const discountNote = (label: string, amount: number) => ` · zmražení ${label} −${formatPrice(amount)}`;
