import { addDays, daysInMonth, diffDays, easter, iso, nthWeekday, shiftYears, yearOf, type ISODate } from './dates'
import { type Activity, type CalendarEntry } from './model'
import { norm } from './parse'

/** One appearance of a yearly-calendar entry in a concrete year. */
export interface Occurrence {
  name: string
  kind: string
  from: ISODate
  to: ISODate
  /** The day itself when the entry is a season around a moving day (Black Friday inside November). */
  mainDay: ISODate | null
  markets: string[]
  note: string
  year: number
}

const WEEKDAY_WORDS = ['pondělí', 'úterý', 'středa', 'čtvrtek', 'pátek', 'sobota', 'neděle']
const MONTH_WORDS = ['lednu', 'únoru', 'březnu', 'dubnu', 'květnu', 'červnu', 'červenci', 'srpnu', 'září', 'říjnu', 'listopadu', 'prosinci']

/**
 * Dates of a moving day in a year. Understands the named days the team plans around and
 * the general form '2. neděle v květnu'. Unknown rules give null, so a typo never shows a wrong date.
 */
export function movingDates(rule: string, year: number): { from: ISODate; to: ISODate } | null {
  const r = norm(rule)
  if (!r) return null
  if (r === 'velikonoce') {
    const e = easter(year)
    return { from: addDays(e, -2), to: addDays(e, 1) }
  }
  const thanksgiving = nthWeekday(year, 10, 3, 4)
  if (r === 'black friday') return { from: addDays(thanksgiving, 1), to: addDays(thanksgiving, 1) }
  if (r === 'cyber monday') return { from: addDays(thanksgiving, 4), to: addDays(thanksgiving, 4) }
  const m = /^(\d)\.\s*(\S+)\s+(?:v|ve)\s+(\S+)$/.exec(r)
  if (m) {
    const wd = WEEKDAY_WORDS.indexOf(m[2]), month = MONTH_WORDS.indexOf(m[3]), n = Number(m[1])
    if (wd < 0 || month < 0 || n < 1 || n > 5) return null
    const day = nthWeekday(year, month, wd, n)
    if (Number(day.slice(5, 7)) - 1 !== month) return null
    return { from: day, to: day }
  }
  return null
}

const fixed = (year: number, p: { d: number; m: number }): ISODate => iso(year, p.m - 1, Math.min(p.d, daysInMonth(year, p.m - 1)))

export function occurrence(entry: CalendarEntry, year: number): Occurrence | null {
  const moving = entry.rule ? movingDates(entry.rule, year) : null
  const base = { name: entry.name, kind: entry.kind, markets: entry.markets, note: entry.note, year }
  if (entry.from) {
    const from = fixed(year, entry.from)
    let to = entry.to ? fixed(year, entry.to) : from
    if (to < from) to = fixed(year + 1, entry.to!)
    return { ...base, from, to, mainDay: moving ? moving.from : null }
  }
  if (moving) return { ...base, from: moving.from, to: moving.to, mainDay: null }
  return null
}

export function occurrences(entries: CalendarEntry[], year: number): Occurrence[] {
  return entries.map((e) => occurrence(e, year)).filter((o): o is Occurrence => o !== null).sort((a, b) => a.from.localeCompare(b.from))
}

/** Occurrences touching a date range, including ones that started in the previous year. */
export function occurrencesBetween(entries: CalendarEntry[], from: ISODate, to: ISODate): Occurrence[] {
  const out: Occurrence[] = []
  for (let y = yearOf(from) - 1; y <= yearOf(to); y++) {
    for (const o of occurrences(entries, y)) if (o.from <= to && o.to >= from) out.push(o)
  }
  return out
}

export const themeMatches = (activity: Pick<Activity, 'theme'>, themeName: string): boolean => norm(activity.theme) !== '' && norm(activity.theme) === norm(themeName)

/**
 * Where an activity lands when it is repeated in another year. Activities tied to a moving theme keep
 * their distance from that theme's start (three days before Easter stays three days before Easter);
 * everything else keeps its day and month.
 */
export function shiftToYear(a: Pick<Activity, 'from' | 'to' | 'theme'>, entries: CalendarEntry[], targetYear: number): { from: ISODate; to: ISODate } {
  const sourceYear = yearOf(a.from)
  const entry = entries.find((e) => themeMatches(a, e.name) && e.rule)
  if (entry) {
    const candidates = [sourceYear, sourceYear + 1, sourceYear - 1].map((y) => occurrence(entry, y)).filter((o): o is Occurrence => o !== null)
    const src = candidates.sort((x, y) => Math.abs(diffDays(x.from, a.from)) - Math.abs(diffDays(y.from, a.from)))[0]
    const dst = src ? occurrence(entry, src.year + (targetYear - sourceYear)) : null
    if (src && dst) {
      const anchorSrc = src.mainDay ?? src.from, anchorDst = dst.mainDay ?? dst.from
      const from = addDays(anchorDst, diffDays(anchorSrc, a.from))
      return { from, to: addDays(from, diffDays(a.from, a.to)) }
    }
  }
  const from = shiftYears(a.from, targetYear - sourceYear)
  return { from, to: addDays(from, diffDays(a.from, a.to)) }
}
