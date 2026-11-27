import { monthOf, yearOf, type ISODate } from './dates'
import { brandsOf, groupOf, marketByCode, STATUS, type Activity, type Lists, type MonthlyNumber, type Result } from './model'
import { norm } from './parse'
import { awaitsResult, effectiveStatus } from './status'

export interface Totals {
  cost: number | null
  revenue: number | null
  orders: number | null
  visits: number | null
  sent: number | null
  openRate: number | null
  ctr: number | null
  grossProfit: number | null
  /** MKT profit 1 = gross profit − cost; known only when gross profit is. */
  profit: number | null
  rating: number | null
  lesson: string
}

const sum = (xs: (number | null)[]): number | null => {
  const ys = xs.filter((x): x is number => x != null)
  return ys.length ? ys.reduce((a, b) => a + b, 0) : null
}

/** Rates weigh by the number sent where it is known, so a small segment cannot skew the whole send-out. */
function rate(rows: Result[], pick: (r: Result) => number | null): number | null {
  const withRate = rows.filter((r) => pick(r) != null)
  if (!withRate.length) return null
  const weighted = withRate.filter((r) => (r.sent ?? 0) > 0)
  if (weighted.length === withRate.length) {
    const total = weighted.reduce((a, r) => a + r.sent!, 0)
    return weighted.reduce((a, r) => a + pick(r)! * r.sent!, 0) / total
  }
  return withRate.reduce((a, r) => a + pick(r)!, 0) / withRate.length
}

export const mktProfit = (grossProfit: number | null, cost: number | null): number | null => (grossProfit == null ? null : grossProfit - (cost ?? 0))

/** One activity can have a single result or one per market; this adds them up. */
export function totals(rows: Result[]): Totals {
  const cost = sum(rows.map((r) => r.cost))
  const grossProfit = sum(rows.map((r) => r.grossProfit))
  return {
    cost,
    revenue: sum(rows.map((r) => r.revenue)),
    orders: sum(rows.map((r) => r.orders)),
    visits: sum(rows.map((r) => r.visits)),
    sent: sum(rows.map((r) => r.sent)),
    openRate: rate(rows, (r) => r.openRate),
    ctr: rate(rows, (r) => r.ctr),
    grossProfit,
    profit: mktProfit(grossProfit, cost),
    rating: rows.find((r) => r.rating != null)?.rating ?? null,
    lesson: rows.find((r) => r.lesson)?.lesson ?? '',
  }
}

export function resultsById(results: Result[]): Map<string, Result[]> {
  const map = new Map<string, Result[]>()
  for (const r of results) map.set(r.activityId, [...(map.get(r.activityId) ?? []), r])
  return map
}

/** Average gross margin of the activity's markets, in percent; null when none of them has one. */
export function activityMargin(markets: string[], lists: Lists): number | null {
  const ms = markets.map((code) => marketByCode(lists, code)?.margin).filter((m): m is number => m != null && m > 0)
  return ms.length ? ms.reduce((a, b) => a + b, 0) / ms.length : null
}

export const suggestGrossProfit = (revenue: number | null, margin: number | null): number | null =>
  revenue == null || margin == null ? null : Math.round((revenue * margin) / 100)

/** Share of an activity that belongs to each brand, by its number of markets. */
export function brandShares(markets: string[], lists: Lists): Map<string, number> {
  const shares = new Map<string, number>()
  if (!markets.length) return shares
  for (const code of markets) {
    const brand = marketByCode(lists, code)?.brand ?? code
    shares.set(brand, (shares.get(brand) ?? 0) + 1 / markets.length)
  }
  return shares
}

export interface MonthSeries {
  plan: number[]
  actual: number[]
  revenue: number[]
  profit: number[]
  financePlan: number[]
  financeActual: number[]
}

const emptySeries = (): MonthSeries => ({
  plan: Array(12).fill(0), actual: Array(12).fill(0), revenue: Array(12).fill(0), profit: Array(12).fill(0),
  financePlan: Array(12).fill(0), financeActual: Array(12).fill(0),
})

/**
 * Plan and reality per brand and month of one year. An activity counts in the month it starts.
 * Activities across several brands are split by their markets; results entered for one market go to its brand.
 */
export function planVsActual(activities: Activity[], byId: Map<string, Result[]>, monthly: MonthlyNumber[], lists: Lists, year: number): Map<string, MonthSeries> {
  const out = new Map<string, MonthSeries>()
  const series = (brand: string): MonthSeries => {
    if (!out.has(brand)) out.set(brand, emptySeries())
    return out.get(brand)!
  }
  for (const m of lists.markets) if (m.active) series(m.brand)
  for (const a of activities) {
    if (yearOf(a.from) !== year || norm(a.status) === norm(STATUS.cancelled) || norm(a.status) === norm(STATUS.deleted)) continue
    const month = monthOf(a.from)
    const shares = brandShares(a.markets, lists)
    if (!shares.size) shares.set('Bez značky', 1)
    for (const [brand, share] of shares) if (a.budget) series(brand).plan[month] += a.budget * share
    for (const r of byId.get(a.id) ?? []) {
      const target = r.market ? new Map([[marketByCode(lists, r.market)?.brand ?? r.market, 1]]) : shares
      for (const [brand, share] of target) {
        const s = series(brand)
        s.actual[month] += (r.cost ?? 0) * share
        s.revenue[month] += (r.revenue ?? 0) * share
        if (r.grossProfit != null) s.profit[month] += (r.grossProfit - (r.cost ?? 0)) * share
      }
    }
  }
  for (const n of monthly) {
    if (Number(n.month.slice(0, 4)) !== year) continue
    const month = Number(n.month.slice(5, 7)) - 1
    const brand = marketByCode(lists, n.market)?.brand ?? (n.market || 'Bez značky')
    const s = series(brand)
    s.financePlan[month] += n.planCost ?? 0
    s.financeActual[month] += n.actualCost ?? 0
  }
  return out
}

export interface Ranked {
  key: string
  label: string
  sub: string
  profit: number
  cost: number | null
  revenue: number | null
  activityIds: string[]
}

/** Activities (or whole themes) of a year that have an MKT profit 1, best first. */
export function ranked(activities: Activity[], byId: Map<string, Result[]>, mode: 'activity' | 'theme', year: number): Ranked[] {
  const rows: Ranked[] = []
  const inYear = activities.filter((a) => yearOf(a.from) === year)
  if (mode === 'activity') {
    for (const a of inYear) {
      const t = totals(byId.get(a.id) ?? [])
      if (t.profit == null) continue
      rows.push({ key: a.id, label: a.name, sub: a.channel, profit: t.profit, cost: t.cost, revenue: t.revenue, activityIds: [a.id] })
    }
  } else {
    const groups = new Map<string, Activity[]>()
    for (const a of inYear) {
      if (!norm(a.theme)) continue
      groups.set(norm(a.theme), [...(groups.get(norm(a.theme)) ?? []), a])
    }
    for (const [key, group] of groups) {
      const t = totals(group.flatMap((a) => byId.get(a.id) ?? []))
      if (t.profit == null) continue
      rows.push({ key, label: group[0].theme, sub: `${group.length} aktivit`, profit: t.profit, cost: t.cost, revenue: t.revenue, activityIds: group.map((a) => a.id) })
    }
  }
  return rows.sort((a, b) => b.profit - a.profit)
}

export function pendingEvaluation(activities: Activity[], byId: Map<string, Result[]>, today: ISODate): Activity[] {
  return activities.filter((a) => awaitsResult(a, (byId.get(a.id) ?? []).length > 0, today)).sort((a, b) => b.to.localeCompare(a.to))
}

export interface Filters {
  brands: string[]
  groups: string[]
  statuses: string[]
  search: string
}

export const noFilters = (): Filters => ({ brands: [], groups: [], statuses: [], search: '' })

export const filtersActive = (f: Filters): boolean => f.brands.length + f.groups.length + f.statuses.length > 0 || f.search.trim() !== ''

/** Empty lists mean "everything"; deleted activities never show. */
export function applyFilters(activities: Activity[], f: Filters, lists: Lists, byId: Map<string, Result[]>, today: ISODate): Activity[] {
  const q = norm(f.search)
  return activities.filter((a) => {
    const status = effectiveStatus(a, (byId.get(a.id) ?? []).length > 0, today)
    if (status === STATUS.deleted) return false
    if (f.statuses.length ? !f.statuses.includes(status) : status === STATUS.cancelled) return false
    if (f.brands.length && !brandsOf(lists, a.markets).some((b) => f.brands.includes(b))) return false
    if (f.groups.length && !f.groups.includes(groupOf(lists, a.channel))) return false
    if (q && !norm([a.name, a.theme, a.channel, a.owner, a.code, a.mechanics, a.note, a.markets.join(' ')].join(' ')).includes(q)) return false
    return true
  })
}

export interface MonthCell {
  count: number
  cost: number
  profit: number
  hasProfit: boolean
}

/** Per month of a year: how many activities started, what they cost and what they earned. */
export function monthSummary(activities: Activity[], byId: Map<string, Result[]>, year: number): MonthCell[] {
  const cells: MonthCell[] = Array.from({ length: 12 }, () => ({ count: 0, cost: 0, profit: 0, hasProfit: false }))
  for (const a of activities) {
    if (yearOf(a.from) !== year) continue
    const cell = cells[monthOf(a.from)]
    cell.count++
    const t = totals(byId.get(a.id) ?? [])
    cell.cost += t.cost ?? 0
    if (t.profit != null) {
      cell.profit += t.profit
      cell.hasProfit = true
    }
  }
  return cells
}
