import { occurrence, themeMatches, type Occurrence } from './calendar'
import { addDays, diffDays, formatDate, monthKey, MONTHS, overlaps, yearOf, type ISODate } from './dates'
import { allBrands, channelByName, groupOf, marketByCode, STATUS, type Activity, type ActivityInput, type CalendarEntry, type CompetitorAction, type Decision, type Lists, type MonthlyNumber, type Result } from './model'
import { money, norm, signedMoney } from './parse'
import { totals } from './stats'

export interface Suggestion {
  key: string
  rule: 'tema' | 'rozpocet' | 'mezera'
  /** Lower comes first. */
  priority: number
  title: string
  reasons: string[]
  /** Repeat last time's activities of a theme in the coming year, when there are any. */
  repeat?: { theme: string; ids: string[]; targetYear: number }
  /** What the "new activity" form opens with. */
  prefill: Partial<ActivityInput>
}

/** Channel groups that run all year and come from monthly numbers, not from planned activities. */
export const ALWAYS_ON_GROUPS = ['Performance']

const live = (a: Activity): boolean => norm(a.status) !== norm(STATUS.cancelled) && norm(a.status) !== norm(STATUS.deleted)

const weeksWord = (n: number): string => (n === 1 ? 'týden' : n >= 2 && n <= 4 ? 'týdny' : 'týdnů')
const activitiesWord = (n: number): string => (n === 1 ? 'aktivita' : n >= 2 && n <= 4 ? 'aktivity' : 'aktivit')

const DEFAULT_LEAD: Record<string, number> = { 'akce': 8, 'sezóna': 6, 'významný den': 3 }

interface Context {
  activities: Activity[]
  byId: Map<string, Result[]>
  calendar: CalendarEntry[]
  competitors: CompetitorAction[]
  monthly: MonthlyNumber[]
  lists: Lists
  today: ISODate
}

/** Rule 1: a theme from the yearly calendar is coming and nothing is planned for it. */
function themeSuggestions(c: Context): Suggestion[] {
  const out: Suggestion[] = []
  for (const entry of c.calendar) {
    const upcoming = [yearOf(c.today), yearOf(c.today) + 1]
      .map((y) => occurrence(entry, y))
      .filter((o): o is Occurrence => o !== null && o.to >= c.today)
      .sort((a, b) => a.from.localeCompare(b.from))[0]
    if (!upcoming) continue
    const past = c.activities.filter((a) => live(a) && themeMatches(a, entry.name) && a.to < addDays(upcoming.from, -120))
    const lastYear = past.length ? Math.max(...past.map((a) => yearOf(a.from))) : null
    const last = past.filter((a) => yearOf(a.from) === lastYear)
    const leads = last.map((a) => channelByName(c.lists, a.channel)?.leadWeeks ?? 0)
    const leadWeeks = Math.max(DEFAULT_LEAD[norm(entry.kind)] ?? 4, ...leads)
    const daysAhead = diffDays(c.today, upcoming.from)
    const isDay = norm(entry.kind) === 'významný den'
    if (daysAhead > leadWeeks * 7 + (isDay ? 0 : 28)) continue
    if (isDay && !last.length && daysAhead > 21) continue
    const planned = c.activities.filter((a) => live(a) && themeMatches(a, entry.name) && overlaps(a.from, a.to, addDays(upcoming.from, -90), addDays(upcoming.to, 30)))
    if (planned.length) continue

    const weeks = Math.round(daysAhead / 7)
    const when = daysAhead <= 0 ? 'právě probíhá' : daysAhead < 7 ? `za ${daysAhead} ${daysAhead === 1 ? 'den' : daysAhead < 5 ? 'dny' : 'dní'}` : `za ${weeks} ${weeksWord(weeks)}`
    const reasons: string[] = []
    if (last.length && lastYear) {
      const best = last.map((a) => ({ a, t: totals(c.byId.get(a.id) ?? []) })).filter((x) => x.t.profit != null).sort((x, y) => y.t.profit! - x.t.profit!)[0]
      reasons.push(`V roce ${lastYear}: ${last.length} ${activitiesWord(last.length)}${best ? `, nejlíp vyšla „${best.a.name}“ (MKT profit 1 ${signedMoney(best.t.profit)})` : ''}`)
      const lesson = last.map((a) => totals(c.byId.get(a.id) ?? []).lesson).find(Boolean)
      if (lesson) reasons.push(`Poznámka z minula: „${lesson}“`)
    } else {
      reasons.push('V plánu k tomuhle tématu zatím nic není, ani z minulých let.')
    }
    const lastOcc = occurrence(entry, upcoming.year - 1)
    if (lastOcc) {
      const rivals = c.competitors.filter((x) => overlaps(x.from, x.to, addDays(lastOcc.from, -14), addDays(lastOcc.to, 7)))
      if (rivals.length) reasons.push(`Konkurence ve stejných týdnech loni: ${rivals.length} ${rivals.length === 1 ? 'záznam' : rivals.length < 5 ? 'záznamy' : 'záznamů'}`)
    }
    if (entry.note) reasons.push(entry.note)
    out.push({
      key: `tema:${norm(entry.name)}:${upcoming.year}`,
      rule: 'tema',
      priority: (isDay ? 200 : 100) + Math.max(0, daysAhead),
      title: `${entry.name}: ${when}, naplánováno 0 aktivit`,
      reasons,
      repeat: last.length ? { theme: entry.name, ids: last.map((a) => a.id), targetYear: upcoming.year } : undefined,
      prefill: { theme: entry.name, from: upcoming.mainDay ?? upcoming.from, to: upcoming.mainDay ?? upcoming.from, markets: entry.markets, name: entry.name },
    })
  }
  return out
}

/** Rule 2: the budget has money for a month and a channel group, and no activity uses it. */
function budgetSuggestions(c: Context): Suggestion[] {
  const out: Suggestion[] = []
  const firstMonth = monthKey(c.today), lastMonth = monthKey(addDays(c.today, 100))
  const sums = new Map<string, { month: string; group: string; brand: string; plan: number }>()
  for (const n of c.monthly) {
    if (!n.planCost || n.planCost <= 0 || n.month < firstMonth || n.month > lastMonth || !n.group || ALWAYS_ON_GROUPS.includes(n.group)) continue
    const brand = marketByCode(c.lists, n.market)?.brand ?? n.market
    const key = `${n.month}:${n.group}:${brand}`
    const row = sums.get(key) ?? { month: n.month, group: n.group, brand, plan: 0 }
    row.plan += n.planCost
    sums.set(key, row)
  }
  for (const [key, row] of sums) {
    const used = c.activities.some((a) => live(a) && monthKey(a.from) <= row.month && monthKey(a.to) >= row.month && groupOf(c.lists, a.channel) === row.group
      && a.markets.some((code) => (marketByCode(c.lists, code)?.brand ?? code) === row.brand))
    if (used) continue
    const [y, m] = row.month.split('-').map(Number)
    out.push({
      key: `rozpocet:${key}`,
      rule: 'rozpocet',
      priority: 300 + diffDays(c.today, `${row.month}-01`),
      title: `${row.group} v měsíci ${MONTHS[m - 1]} ${y}: rozpočet ${money(row.plan)} a žádná aktivita`,
      reasons: [`Značka ${row.brand}. Částka je z finančního plánu (list Měsíční čísla).`],
      prefill: { from: `${row.month}-01` > c.today ? `${row.month}-01` : c.today, to: `${row.month}-01` > c.today ? `${row.month}-01` : c.today,
        markets: c.lists.markets.filter((mk) => mk.active && mk.brand === row.brand).map((mk) => mk.code), budget: Math.round(row.plan) },
    })
  }
  return out
}

export const GAP_DAYS = 42

/** Rule 3: a brand's market has nothing planned in the coming six weeks. */
function gapSuggestions(c: Context): Suggestion[] {
  if (!c.activities.some(live)) return []
  const out: Suggestion[] = []
  const until = addDays(c.today, GAP_DAYS)
  for (const brand of allBrands(c.lists)) {
    const markets = c.lists.markets.filter((m) => m.active && m.brand === brand)
    const empty = markets.filter((m) => !c.activities.some((a) => live(a) && overlaps(a.from, a.to, c.today, until) && a.markets.some((code) => norm(code) === norm(m.code))))
    if (!empty.length) continue
    const all = empty.length === markets.length
    out.push({
      key: `mezera:${norm(brand)}:${monthKey(c.today)}`,
      rule: 'mezera',
      priority: 400 + (all ? 0 : 10),
      title: all ? `${brand}: v příštích 6 týdnech není nic naplánováno` : `${brand}: v příštích 6 týdnech není nic pro ${empty.map((m) => m.country).join(', ')}`,
      reasons: [`Do ${formatDate(until, false)} tu není žádná aktivita (zrušené se nepočítají).`],
      prefill: { markets: empty.map((m) => m.code), from: c.today, to: c.today },
    })
  }
  return out
}

/** A decision hides a suggestion: accepted and dismissed for good, postponed until its date. */
export function isHidden(key: string, decisions: Decision[], today: ISODate): boolean {
  const d = [...decisions].reverse().find((x) => x.key === key)
  if (!d) return false
  if (norm(d.decision) === 'odloženo') return d.until !== '' && d.until > today
  return true
}

export function suggestions(c: Context, decisions: Decision[]): Suggestion[] {
  return [...themeSuggestions(c), ...budgetSuggestions(c), ...gapSuggestions(c)]
    .filter((s) => !isHidden(s.key, decisions, c.today))
    .sort((a, b) => a.priority - b.priority)
}
