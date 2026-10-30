import { pragueLocalToDate } from "@/lib/dates";

/**
 * Program Dovolená: a member with commitment plans a week away twice a year
 * (from 2027), can't book classes that week and pays that month less – the
 * week's share of the monthly fee by days.
 */
export const VACATION = {
  from: pragueLocalToDate("2027-01-01T00:00"),
  perYear: 2,
  days: 7,
  /** planned at least this many days ahead (the studio may plan it any time) */
  noticeDays: 7,
};
