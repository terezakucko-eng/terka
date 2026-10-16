/** Dates are plain 'YYYY-MM-DD' strings everywhere; arithmetic runs in UTC so no time zone can shift a day. */
export type ISODate = string

const DAY = 86_400_000

export const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
export const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']

export const isISODate = (s: unknown): s is ISODate => typeof s === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(s)

export function toISO(d: Date): ISODate {
  return d.toISOString().slice(0, 10)
}

export function fromISO(s: ISODate): Date {
  return new Date(`${s}T00:00:00Z`)
}

export function iso(year: number, month0: number, day: number): ISODate {
  return toISO(new Date(Date.UTC(year, month0, day)))
}

/** Today in the viewer's own calendar (Prague for the team). */
export function todayISO(now = new Date()): ISODate {
  return iso(now.getFullYear(), now.getMonth(), now.getDate())
}

export const addDays = (s: ISODate, n: number): ISODate => toISO(new Date(fromISO(s).getTime() + n * DAY))

export const diffDays = (from: ISODate, to: ISODate): number => Math.round((fromISO(to).getTime() - fromISO(from).getTime()) / DAY)

/** 0 = Monday … 6 = Sunday */
export const weekday = (s: ISODate): number => (fromISO(s).getUTCDay() + 6) % 7

export const yearOf = (s: ISODate): number => Number(s.slice(0, 4))
export const monthOf = (s: ISODate): number => Number(s.slice(5, 7)) - 1

export const overlaps = (aFrom: ISODate, aTo: ISODate, bFrom: ISODate, bTo: ISODate): boolean => aFrom <= bTo && bFrom <= aTo

export const daysInMonth = (year: number, month0: number): number => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()

/** Weeks (Monday first) covering the whole month, each a list of 7 dates. */
export function monthWeeks(year: number, month0: number): ISODate[][] {
  const first = iso(year, month0, 1)
  const last = iso(year, month0, daysInMonth(year, month0))
  let day = addDays(first, -weekday(first))
  const weeks: ISODate[][] = []
  while (day <= last) {
    weeks.push(Array.from({ length: 7 }, (_, i) => addDays(day, i)))
    day = addDays(day, 7)
  }
  return weeks
}

export function formatDate(s: ISODate, withYear = true): string {
  const [y, m, d] = s.split('-').map(Number)
  return withYear ? `${d}. ${m}. ${y}` : `${d}. ${m}.`
}

export function formatRange(from: ISODate, to: ISODate): string {
  if (from === to) return formatDate(from)
  return `${formatDate(from, yearOf(from) !== yearOf(to))} – ${formatDate(to)}`
}

export const monthTitle = (year: number, month0: number): string => `${MONTHS[month0][0].toUpperCase()}${MONTHS[month0].slice(1)} ${year}`

/** Easter Sunday (Gregorian, anonymous algorithm). */
export function easter(year: number): ISODate {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100
  const d = Math.floor(b / 4), e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4), k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const month = Math.floor((h + l - 7 * m + 114) / 31)
  const day = ((h + l - 7 * m + 114) % 31) + 1
  return iso(year, month - 1, day)
}

/** n-th given weekday of a month (weekday 0 = Monday … 6 = Sunday). */
export function nthWeekday(year: number, month0: number, wd: number, n: number): ISODate {
  const first = iso(year, month0, 1)
  return addDays(first, ((wd - weekday(first) + 7) % 7) + (n - 1) * 7)
}
