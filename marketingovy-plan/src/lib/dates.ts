/** Dates are plain 'YYYY-MM-DD' strings everywhere; arithmetic runs in UTC so no time zone can shift a day. */
export type ISODate = string

const DAY = 86_400_000

export const MONTHS = ['leden', 'únor', 'březen', 'duben', 'květen', 'červen', 'červenec', 'srpen', 'září', 'říjen', 'listopad', 'prosinec']
export const MONTHS_SHORT = ['led', 'úno', 'bře', 'dub', 'kvě', 'čvn', 'čvc', 'srp', 'zář', 'říj', 'lis', 'pro']
export const WEEKDAYS = ['Po', 'Út', 'St', 'Čt', 'Pá', 'So', 'Ne']
export const WEEKDAYS_LONG = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle']

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
export const dayOf = (s: ISODate): number => Number(s.slice(8, 10))

export const overlaps = (aFrom: ISODate, aTo: ISODate, bFrom: ISODate, bTo: ISODate): boolean => aFrom <= bTo && bFrom <= aTo

export const daysInMonth = (year: number, month0: number): number => new Date(Date.UTC(year, month0 + 1, 0)).getUTCDate()

export const daysInYear = (year: number): number => diffDays(iso(year, 0, 1), iso(year + 1, 0, 1))

export const mondayOf = (s: ISODate): ISODate => addDays(s, -weekday(s))

/** Weeks (Monday first) covering the whole month, each a list of 7 dates. */
export function monthWeeks(year: number, month0: number): ISODate[][] {
  const first = iso(year, month0, 1)
  const last = iso(year, month0, daysInMonth(year, month0))
  let day = mondayOf(first)
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

export function formatRange(from: ISODate, to: ISODate, withYear = true): string {
  if (from === to) return formatDate(from, withYear)
  const sameYear = yearOf(from) === yearOf(to)
  if (sameYear && monthOf(from) === monthOf(to)) return `${dayOf(from)}.–${formatDate(to, withYear)}`
  return `${formatDate(from, withYear && !sameYear)} – ${formatDate(to, withYear)}`
}

export const monthTitle = (year: number, month0: number): string => `${MONTHS[month0]} ${year}`

/** Same day and month in another year; 29 February falls back to 28. */
export function shiftYears(s: ISODate, years: number): ISODate {
  const y = yearOf(s) + years
  const m = monthOf(s)
  return iso(y, m, Math.min(dayOf(s), daysInMonth(y, m)))
}

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

const valid = (y: number, m: number, d: number): ISODate | null => {
  if (!(y >= 1900 && y <= 2200 && m >= 1 && m <= 12 && d >= 1 && d <= daysInMonth(y, m - 1))) return null
  return iso(y, m - 1, d)
}

/**
 * Reads a date the way the sheet shows it: '4. 11. 2026', '4.11.2026', '2026-11-04',
 * each optionally followed by a time. Returns null for anything else.
 */
export function parseDate(raw: unknown): ISODate | null {
  if (typeof raw !== 'string') return null
  const s = raw.trim()
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})(?:[T\s].*)?$/.exec(s)
  if (m) return valid(Number(m[1]), Number(m[2]), Number(m[3]))
  m = /^(\d{1,2})\.\s*(\d{1,2})\.\s*(\d{4})(?:\s.*)?$/.exec(s)
  if (m) return valid(Number(m[3]), Number(m[2]), Number(m[1]))
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(s)
  if (m) return valid(Number(m[3]), Number(m[2]), Number(m[1]))
  // A cell without a date format shows the date as a day count since 30. 12. 1899, with the time as a decimal part.
  m = /^(\d{5})(?:[.,]\d+)?$/.exec(s)
  if (m && Number(m[1]) >= 36526 && Number(m[1]) <= 73415) return toISO(new Date(Date.UTC(1899, 11, 30) + Number(m[1]) * DAY))
  return null
}

/** '14. 2.' or '14.2.' (a year, if present, is ignored). */
export function parseDayMonth(raw: unknown): { d: number; m: number } | null {
  if (typeof raw !== 'string') return null
  const m = /^(\d{1,2})\.\s*(\d{1,2})\.?(?:\s*\d{4})?$/.exec(raw.trim())
  if (!m) return null
  const d = Number(m[1]), mo = Number(m[2])
  if (mo < 1 || mo > 12 || d < 1 || d > daysInMonth(2024, mo - 1)) return null
  return { d, m: mo }
}

/** What the app writes into a date cell; the sheet turns it into a real date. */
export const toSheetDate = (s: ISODate): string => formatDate(s)

export function sheetStamp(now = new Date()): string {
  const p = (n: number) => String(n).padStart(2, '0')
  return `${now.getDate()}. ${now.getMonth() + 1}. ${now.getFullYear()} ${now.getHours()}:${p(now.getMinutes())}`
}

export const monthKey = (s: ISODate): string => s.slice(0, 7)
