import { describe, expect, it } from 'vitest'
import { movingDates, occurrence, occurrencesBetween, shiftToYear } from '../src/lib/calendar'
import { formatRange, parseDate, parseDayMonth, shiftYears } from '../src/lib/dates'
import { activityFromRow, activityToCells, calendarFromRow, listsFromMatrix, STATUS, type Activity, type CalendarEntry, type Result, type Row } from '../src/lib/model'
import { colLetter, moneyShort, norm, numCell, parseNumber, safeText, splitList } from '../src/lib/parse'
import { isHidden, suggestions } from '../src/lib/recommend'
import { activityMargin, applyFilters, noFilters, pendingEvaluation, planVsActual, ranked, resultsById, suggestGrossProfit, totals } from '../src/lib/stats'
import { effectiveStatus, overdue } from '../src/lib/status'
import { exampleSeed } from '../src/data/mockApi'

const lists = listsFromMatrix(exampleSeed()['Číselníky'].map((r) => r.map((c) => String(c ?? ''))))

const act = (over: Partial<Activity>): Activity => ({
  id: 'A1', name: 'Test', from: '2026-11-04', to: '2026-11-04', markets: ['RS CZ'], channel: 'SMS', owner: 'T', status: STATUS.approved, type: '',
  theme: '', mechanics: '', code: '', budget: null, note: '', links: { basecamp: '', drive: '', graphics: '', sheet: '', targito: '' }, source: '', ...over,
})
const res = (over: Partial<Result>): Result => ({
  activityId: 'A1', market: '', cost: null, revenue: null, orders: null, visits: null, sent: null, openRate: null, ctr: null, grossProfit: null,
  rating: null, lesson: '', numbersSource: '', by: '', at: '', ...over,
})

describe('numbers as the sheet shows them', () => {
  it('reads Czech formats', () => {
    expect(parseNumber('118 756 Kč')).toBe(118756)
    expect(parseNumber('118 756')).toBe(118756)
    expect(parseNumber('64,4')).toBe(64.4)
    expect(parseNumber('27,3 %')).toBe(27.3)
    expect(parseNumber('−1 200')).toBe(-1200)
    expect(parseNumber('1.234,5')).toBe(1234.5)
    expect(parseNumber('1.234')).toBe(1234)
    expect(parseNumber('12.5')).toBe(12.5)
    expect(parseNumber('')).toBeNull()
    expect(parseNumber('–')).toBeNull()
  })
  it('writes nothing instead of zero', () => {
    expect(numCell(0)).toBe('')
    expect(numCell(null)).toBe('')
    expect(numCell(12.345)).toBe(12.35)
  })
  it('keeps risky text as text', () => {
    expect(safeText('=SUM(A1)')).toBe("'=SUM(A1)")
    expect(safeText('+420 777')).toBe("'+420 777")
    expect(safeText('0123')).toBe("'0123")
    expect(safeText('12. 5.')).toBe("'12. 5.")
    expect(safeText('BLACK')).toBe('BLACK')
    expect(safeText('  SMS Black Friday ')).toBe('SMS Black Friday')
  })
  it('names columns', () => {
    expect([0, 25, 26, 51, 52].map(colLetter)).toEqual(['A', 'Z', 'AA', 'AZ', 'BA'])
    expect(splitList('RS CZ, RS SK;KS CZ')).toEqual(['RS CZ', 'RS SK', 'KS CZ'])
    expect(moneyShort(2_400_000)).toBe('2,4 mil.')
    expect(moneyShort(0)).toBe('')
  })
})

describe('dates', () => {
  it('reads what the sheet shows', () => {
    expect(parseDate('4. 11. 2026')).toBe('2026-11-04')
    expect(parseDate('4.11.2026')).toBe('2026-11-04')
    expect(parseDate('2026-11-04')).toBe('2026-11-04')
    expect(parseDate('27. 11. 2026 22:15')).toBe('2026-11-27')
    expect(parseDate('31. 2. 2026')).toBeNull()
    expect(parseDate('zítra')).toBeNull()
    // a cell without a date format shows the day count of the sheet
    expect(parseDate('46330')).toBe('2026-11-04')
    expect(parseDate('46353,95139')).toBe('2026-11-27')
    expect(parseDate('46353.5')).toBe('2026-11-27')
    expect(parseDate('12345')).toBeNull()
    expect(parseDate('2026')).toBeNull()
    expect(parseDayMonth('14. 2.')).toEqual({ d: 14, m: 2 })
    expect(parseDayMonth('14.2.2026')).toEqual({ d: 14, m: 2 })
    expect(parseDayMonth('40. 2.')).toBeNull()
  })
  it('shifts and formats', () => {
    expect(shiftYears('2024-02-29', 1)).toBe('2025-02-28')
    expect(formatRange('2026-11-03', '2026-11-04')).toBe('3.–4. 11. 2026')
    expect(formatRange('2026-11-04', '2026-11-04')).toBe('4. 11. 2026')
    expect(formatRange('2026-12-25', '2027-01-02')).toBe('25. 12. 2026 – 2. 1. 2027')
  })
})

describe('lists and rows', () => {
  it('finds the blocks of the lists sheet', () => {
    expect(lists.markets.map((m) => m.code)).toContain('Flagranti SK')
    expect(lists.markets.find((m) => m.code === 'RS CZ')).toMatchObject({ brand: 'Růžový slon', margin: 64.4, color: '#e0077d' })
    expect(lists.channels.find((c) => c.name === 'Newsletter')).toMatchObject({ group: 'CRM', fields: ['sent', 'openRate', 'ctr', 'cost', 'revenue', 'orders'], leadWeeks: 1 })
    expect(lists.statuses).toEqual(['Nápad', 'V přípravě', 'Schváleno', 'Běží', 'Hotovo', 'Vyhodnoceno', 'Zrušeno'])
    expect(lists.people[0]).toBe('Tereza Kucková')
    expect(lists.competitors[0]).toEqual({ name: 'eroticcity.cz', country: 'CZ', watch: true })
  })
  it('round-trips an activity', () => {
    const a = act({ name: 'SMS Black Friday', to: '2026-11-11', markets: ['RS CZ', 'RS SK'], budget: 118756, code: '0123' })
    const cells = activityToCells(a)
    expect(cells['Datum od']).toBe('4. 11. 2026')
    expect(cells['Slevový kód']).toBe("'0123")
    const row: Row = { id: 'A1' }
    for (const [k, v] of Object.entries(cells)) row[norm(k)] = String(v).replace(/^'/, '')
    expect(activityFromRow(row)).toMatchObject({ name: 'SMS Black Friday', from: '2026-11-04', to: '2026-11-11', markets: ['RS CZ', 'RS SK'], budget: 118756, code: '0123' })
  })
  it('skips rows without a name or a date', () => {
    expect(activityFromRow({ [norm('Název')]: 'x', [norm('Datum od')]: 'někdy' })).toBeNull()
    expect(activityFromRow({ [norm('Datum od')]: '1. 1. 2026' })).toBeNull()
  })
})

describe('yearly calendar', () => {
  const entry = (over: Partial<CalendarEntry>): CalendarEntry => ({ name: 'X', kind: 'Akce', from: null, to: null, rule: '', markets: [], note: '', ...over })
  it('knows the moving days', () => {
    expect(movingDates('Black Friday', 2026)).toEqual({ from: '2026-11-27', to: '2026-11-27' })
    expect(movingDates('Black Friday', 2024)).toEqual({ from: '2024-11-29', to: '2024-11-29' })
    expect(movingDates('Cyber Monday', 2026)?.from).toBe('2026-11-30')
    expect(movingDates('Velikonoce', 2026)).toEqual({ from: '2026-04-03', to: '2026-04-06' })
    expect(movingDates('2. neděle v květnu', 2026)?.from).toBe('2026-05-10')
    expect(movingDates('3. neděle v červnu', 2026)?.from).toBe('2026-06-21')
    expect(movingDates('5. pátek v únoru', 2026)).toBeNull()
    expect(movingDates('někdy na jaře', 2026)).toBeNull()
  })
  it('places entries in a year', () => {
    expect(occurrence(entry({ from: { d: 26, m: 1 }, to: { d: 14, m: 2 } }), 2027)).toMatchObject({ from: '2027-01-26', to: '2027-02-14', mainDay: null })
    expect(occurrence(entry({ from: { d: 1, m: 11 }, to: { d: 30, m: 11 }, rule: 'Black Friday' }), 2026)).toMatchObject({ from: '2026-11-01', to: '2026-11-30', mainDay: '2026-11-27' })
    expect(occurrence(entry({ from: { d: 20, m: 12 }, to: { d: 5, m: 1 } }), 2026)).toMatchObject({ from: '2026-12-20', to: '2027-01-05' })
    expect(occurrencesBetween([entry({ from: { d: 20, m: 12 }, to: { d: 5, m: 1 } })], '2027-01-01', '2027-01-31')).toHaveLength(1)
    expect(calendarFromRow({ [norm('Název')]: 'Jak psát datum', [norm('Aktivní')]: 'ne' })).toBeNull()
  })
  it('repeats an activity relative to a moving theme', () => {
    const easter = entry({ name: 'Velikonoce', rule: 'Velikonoce' })
    expect(shiftToYear(act({ from: '2026-03-30', to: '2026-04-06', theme: 'Velikonoce' }), [easter], 2027)).toEqual({ from: '2027-03-22', to: '2027-03-29' })
    expect(shiftToYear(act({ from: '2026-11-04', to: '2026-11-05' }), [easter], 2027)).toEqual({ from: '2027-11-04', to: '2027-11-05' })
  })
})

describe('status', () => {
  it('follows dates once approved', () => {
    const a = act({ from: '2026-11-10', to: '2026-11-12' })
    expect(effectiveStatus(a, false, '2026-11-09')).toBe('Schváleno')
    expect(effectiveStatus(a, false, '2026-11-11')).toBe('Běží')
    expect(effectiveStatus(a, false, '2026-11-13')).toBe('Hotovo')
    expect(effectiveStatus(a, true, '2026-11-13')).toBe('Vyhodnoceno')
  })
  it('keeps manual states', () => {
    expect(effectiveStatus(act({ status: 'Nápad' }), false, '2027-01-01')).toBe('Nápad')
    expect(overdue(act({ status: 'V přípravě' }), '2027-01-01')).toBe(true)
    expect(effectiveStatus(act({ status: 'Zrušeno' }), true, '2027-01-01')).toBe('Zrušeno')
    expect(effectiveStatus(act({ status: 'Hotovo' }), false, '2026-01-01')).toBe('Schváleno')
  })
})

describe('evaluation', () => {
  it('adds up results and weighs rates', () => {
    const t = totals([res({ cost: 100, grossProfit: 500, sent: 1000, openRate: 20 }), res({ market: 'RS SK', cost: 50, grossProfit: 100, sent: 3000, openRate: 40 })])
    expect(t).toMatchObject({ cost: 150, grossProfit: 600, profit: 450, sent: 4000, openRate: 35 })
    expect(totals([res({ cost: 100 })]).profit).toBeNull()
    expect(totals([res({ grossProfit: 300 })]).profit).toBe(300)
  })
  it('suggests gross profit from the market margin', () => {
    expect(activityMargin(['RS CZ', 'RS SK'], lists)).toBeCloseTo(62.85)
    expect(activityMargin(['Flagranti CZ'], lists)).toBeNull()
    expect(suggestGrossProfit(1000, 64.4)).toBe(644)
  })
  it('splits plan and reality by brand and month', () => {
    const activities = [act({ id: 'A1', budget: 1000, markets: ['RS CZ', 'KS CZ'] }), act({ id: 'A2', from: '2026-02-01', to: '2026-02-01', budget: 300 }), act({ id: 'A3', status: 'Zrušeno', budget: 999 })]
    const byId = resultsById([res({ activityId: 'A1', cost: 800, grossProfit: 2000 }), res({ activityId: 'A2', market: 'RS CZ', cost: 100 })])
    const series = planVsActual(activities, byId, [{ month: '2026-11', market: 'RS CZ', group: 'CRM', channel: 'SMS', planCost: 50, actualCost: 70, revenue: null, orders: null }], lists, 2026)
    expect(series.get('Růžový slon')!.plan[10]).toBe(500)
    expect(series.get('Kondomshop')!.plan[10]).toBe(500)
    expect(series.get('Růžový slon')!.plan[1]).toBe(300)
    expect(series.get('Růžový slon')!.actual[10]).toBe(400)
    expect(series.get('Růžový slon')!.profit[10]).toBe(600)
    expect(series.get('Růžový slon')!.financeActual[10]).toBe(70)
    expect(series.get('Flagranti')!.plan.every((x) => x === 0)).toBe(true)
  })
  it('ranks by MKT profit 1 and lists what waits', () => {
    const activities = [act({ id: 'A1', theme: 'BF' }), act({ id: 'A2', theme: 'BF', channel: 'TV Nova' }), act({ id: 'A3' })]
    const byId = resultsById([res({ activityId: 'A1', cost: 100, grossProfit: 500 }), res({ activityId: 'A2', cost: 300 })])
    expect(ranked(activities, byId, 'activity', 2026).map((r) => [r.key, r.profit])).toEqual([['A1', 400]])
    expect(ranked(activities, byId, 'theme', 2026).map((r) => [r.label, r.profit])).toEqual([['BF', 100]])
    expect(pendingEvaluation(activities, byId, '2026-12-01').map((a) => a.id)).toEqual(['A3'])
    expect(applyFilters(activities, { ...noFilters(), groups: ['TV a video'] }, lists, byId, '2026-12-01').map((a) => a.id)).toEqual(['A2'])
    expect(applyFilters([act({ status: 'Zrušeno' }), act({ status: 'Smazáno' })], noFilters(), lists, byId, '2026-12-01')).toHaveLength(0)
    expect(applyFilters([act({ status: 'Zrušeno' })], { ...noFilters(), statuses: ['Zrušeno'] }, lists, byId, '2026-12-01')).toHaveLength(1)
  })
})

describe('recommendations', () => {
  const valentine: CalendarEntry = { name: 'Valentýn', kind: 'Akce', from: { d: 26, m: 1 }, to: { d: 14, m: 2 }, rule: '', markets: [], note: '' }
  const ctx = (activities: Activity[], today = '2026-11-27') => ({ activities, byId: resultsById([res({ activityId: 'V1', cost: 100, grossProfit: 900, lesson: 'Poslat dřív.' })]), calendar: [valentine], competitors: [], monthly: [], lists, today })
  it('suggests a coming theme with nothing planned, and stops once something is', () => {
    const last = act({ id: 'V1', name: 'SMS Valentýn', from: '2026-02-10', to: '2026-02-10', theme: 'Valentýn' })
    const s = suggestions(ctx([last]), []).find((x) => x.rule === 'tema')!
    expect(s.title).toBe('Valentýn: za 9 týdnů, naplánováno 0 aktivit')
    expect(s.repeat).toEqual({ theme: 'Valentýn', ids: ['V1'], targetYear: 2027 })
    expect(s.reasons[0]).toContain('nejlíp vyšla „SMS Valentýn“')
    expect(s.reasons[1]).toContain('Poslat dřív.')
    const planned = act({ id: 'V2', from: '2027-02-08', to: '2027-02-08', theme: 'valentýn' })
    expect(suggestions(ctx([last, planned]), []).some((x) => x.rule === 'tema')).toBe(false)
    expect(suggestions(ctx([last], '2026-08-01'), []).some((x) => x.rule === 'tema')).toBe(false)
  })
  it('points at markets with nothing ahead, but not in an empty plan', () => {
    expect(suggestions(ctx([]), []).filter((x) => x.rule === 'mezera')).toHaveLength(0)
    const gaps = suggestions(ctx([act({ from: '2026-12-01', to: '2026-12-05', markets: ['RS CZ', 'KS CZ', 'KS SK'] })]), []).filter((x) => x.rule === 'mezera')
    expect(gaps.map((g) => g.title)).toEqual(['Flagranti: v příštích 6 týdnech není nic naplánováno', 'Růžový slon: v příštích 6 týdnech není nic pro SK, HU, RO, SI, HR, BG, prodejny'])
  })
  it('respects decisions', () => {
    expect(isHidden('k', [{ key: 'k', decision: 'Zamítnuto', reason: '', until: '', activityId: '' }], '2026-11-27')).toBe(true)
    expect(isHidden('k', [{ key: 'k', decision: 'Odloženo', reason: '', until: '2026-12-10', activityId: '' }], '2026-11-27')).toBe(true)
    expect(isHidden('k', [{ key: 'k', decision: 'Odloženo', reason: '', until: '2026-11-20', activityId: '' }], '2026-11-27')).toBe(false)
    expect(isHidden('jiný', [], '2026-11-27')).toBe(false)
  })
})
