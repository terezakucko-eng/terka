import { type ISODate, parseDate, parseDayMonth, toSheetDate } from './dates'
import { type Cell, isYes, joinList, norm, numCell, parseNumber, safeText, splitList } from './parse'

/** Sheet (tab) names in the Google spreadsheet. */
export const SHEET = {
  activities: 'Aktivity',
  results: 'Výsledky',
  lists: 'Číselníky',
  calendar: 'Roční kalendář',
  monthly: 'Měsíční čísla',
  competitors: 'Konkurence',
  decisions: 'Doporučení',
} as const

/** Column headers. The app finds columns by these names, so columns may be reordered or added in the sheet. */
export const H = {
  name: 'Název', from: 'Datum od', to: 'Datum do', markets: 'Značka a země', channel: 'Kanál', owner: 'Odpovědný',
  status: 'Stav', type: 'Typ', theme: 'Téma nebo produkt', mechanics: 'Sleva / mechanika', code: 'Slevový kód',
  budget: 'Rozpočet (Kč)', note: 'Popis', linkBasecamp: 'Odkaz Basecamp', linkDrive: 'Odkaz Disk', linkGraphics: 'Odkaz grafika',
  linkSheet: 'Odkaz rodný list', linkTargito: 'Odkaz Targito', id: 'ID', createdBy: 'Založil', createdAt: 'Založeno',
  updatedBy: 'Upravil', updatedAt: 'Upraveno', source: 'Zdroj',
} as const

export const RH = {
  activityId: 'ID aktivity', activityName: 'Název aktivity', market: 'Značka a země', cost: 'Skutečný náklad (Kč)', revenue: 'Tržby (Kč)',
  orders: 'Počet objednávek', visits: 'Návštěvy', sent: 'Odesláno', openRate: 'Open rate (%)', ctr: 'CTR (%)', grossProfit: 'Hrubý zisk (Kč)',
  rating: 'Hodnocení', lesson: 'Co příště jinak', numbersSource: 'Zdroj čísel', by: 'Vyhodnotil', at: 'Vyhodnoceno',
  /** Calculated by a formula in the sheet; the app never writes it. */
  profit: 'MKT profit 1 (Kč)',
} as const

export const CH = {
  from: 'Datum od', to: 'Datum do', competitor: 'Konkurent', country: 'Země', channel: 'Kanál', what: 'Co dělali',
  mechanics: 'Sleva / mechanika', link: 'Odkaz', source: 'Zdroj', confidence: 'Jistota', by: 'Zapsal', at: 'Zapsáno', id: 'ID',
} as const

export const DH = { key: 'Klíč', decision: 'Rozhodnutí', reason: 'Důvod', until: 'Odložit do', activityId: 'ID aktivity', who: 'Kdo', when: 'Kdy' } as const

export const MH = {
  month: 'Měsíc', market: 'Značka a země', group: 'Skupina kanálů', channel: 'Kanál', planCost: 'Plán nákladů (Kč)',
  actualCost: 'Skutečné náklady (Kč)', revenue: 'Tržby (Kč)', orders: 'Počet objednávek', margin: 'Hrubá marže (%)', source: 'Zdroj',
} as const

export const KH = { name: 'Název', kind: 'Druh', from: 'Od', to: 'Do', rule: 'Pohyblivé datum', markets: 'Značky a země', note: 'Poznámka', active: 'Aktivní' } as const

export type Row = Record<string, string>

export const STATUS = {
  idea: 'Nápad', prep: 'V přípravě', approved: 'Schváleno', running: 'Běží', done: 'Hotovo', evaluated: 'Vyhodnoceno',
  cancelled: 'Zrušeno', deleted: 'Smazáno',
} as const

/** The progress as people read it; cancelled sits beside it. */
export const STATUS_FLOW: string[] = [STATUS.idea, STATUS.prep, STATUS.approved, STATUS.running, STATUS.done, STATUS.evaluated]
/** What a person can pick; the rest follows from dates and results. */
export const STATUS_MANUAL: string[] = [STATUS.idea, STATUS.prep, STATUS.approved, STATUS.cancelled]

export interface Market {
  code: string
  brand: string
  country: string
  color: string
  /** Gross margin in percent, used to pre-fill gross profit from revenue. */
  margin: number | null
  active: boolean
}

export type ResultField = 'cost' | 'revenue' | 'orders' | 'visits' | 'sent' | 'openRate' | 'ctr'

const FIELD_WORDS: Record<string, ResultField> = {
  'náklad': 'cost', 'naklad': 'cost', 'tržby': 'revenue', 'trzby': 'revenue', 'objednávky': 'orders', 'objednavky': 'orders',
  'návštěvy': 'visits', 'navstevy': 'visits', 'odesláno': 'sent', 'odeslano': 'sent', 'open rate': 'openRate', 'ctr': 'ctr',
}

export const ALL_FIELDS: ResultField[] = ['sent', 'openRate', 'ctr', 'cost', 'revenue', 'orders', 'visits']

export interface Channel {
  name: string
  group: string
  fields: ResultField[]
  budgetKind: string
  leadWeeks: number
  active: boolean
}

export interface Competitor {
  name: string
  country: string
  watch: boolean
}

export interface Lists {
  markets: Market[]
  channels: Channel[]
  /** Colour of each channel group (hex), from the sheet; groups missing there use DEFAULT_GROUP_COLORS. */
  groupColors: Record<string, string>
  statuses: string[]
  people: string[]
  types: string[]
  competitors: Competitor[]
}

export interface Links {
  basecamp: string
  drive: string
  graphics: string
  sheet: string
  targito: string
}

export const LINK_LABELS: Record<keyof Links, string> = {
  basecamp: 'Basecamp', drive: 'Disk', graphics: 'Grafika', sheet: 'Rodný list', targito: 'Targito kampaň',
}

export const emptyLinks = (): Links => ({ basecamp: '', drive: '', graphics: '', sheet: '', targito: '' })

export interface Activity {
  id: string
  name: string
  from: ISODate
  to: ISODate
  markets: string[]
  channel: string
  owner: string
  /** As written in the sheet; what the app shows is `effectiveStatus`. */
  status: string
  type: string
  theme: string
  mechanics: string
  code: string
  budget: number | null
  note: string
  links: Links
  source: string
  /** Sheet row number, for messages only; writes always look the row up by id. */
  row?: number
}

export type ActivityInput = Omit<Activity, 'id' | 'row'>

export interface Result {
  activityId: string
  /** Empty = the whole activity; otherwise one market of it. */
  market: string
  cost: number | null
  revenue: number | null
  orders: number | null
  visits: number | null
  sent: number | null
  openRate: number | null
  ctr: number | null
  grossProfit: number | null
  rating: number | null
  lesson: string
  numbersSource: string
  by: string
  at: string
  row?: number
}

export type ResultInput = Omit<Result, 'row' | 'by' | 'at'>

export interface CalendarEntry {
  name: string
  kind: string
  from: { d: number; m: number } | null
  to: { d: number; m: number } | null
  rule: string
  markets: string[]
  note: string
}

export interface CompetitorAction {
  id: string
  from: ISODate
  to: ISODate
  competitor: string
  country: string
  channel: string
  what: string
  mechanics: string
  link: string
  source: string
  confidence: string
}

export type CompetitorInput = Omit<CompetitorAction, 'id'>

export interface Decision {
  key: string
  decision: string
  reason: string
  until: ISODate | ''
  activityId: string
}

export interface MonthlyNumber {
  /** 'YYYY-MM' */
  month: string
  market: string
  group: string
  channel: string
  planCost: number | null
  actualCost: number | null
  revenue: number | null
  orders: number | null
}

const get = (row: Row, header: string): string => (row[norm(header)] ?? '').trim()

/** A row of the Aktivity sheet. Rows without a name or a readable start date are not activities. */
export function activityFromRow(row: Row): Activity | null {
  const name = get(row, H.name)
  const from = parseDate(get(row, H.from))
  if (!name || !from) return null
  const to = parseDate(get(row, H.to))
  return {
    id: get(row, H.id),
    name,
    from,
    to: to && to >= from ? to : from,
    markets: splitList(get(row, H.markets)),
    channel: get(row, H.channel),
    owner: get(row, H.owner),
    status: get(row, H.status) || STATUS.idea,
    type: get(row, H.type),
    theme: get(row, H.theme),
    mechanics: get(row, H.mechanics),
    code: get(row, H.code),
    budget: parseNumber(get(row, H.budget)),
    note: get(row, H.note),
    links: {
      basecamp: get(row, H.linkBasecamp), drive: get(row, H.linkDrive), graphics: get(row, H.linkGraphics),
      sheet: get(row, H.linkSheet), targito: get(row, H.linkTargito),
    },
    source: get(row, H.source),
  }
}

/** Cells for the columns an activity owns, keyed by header. */
export function activityToCells(a: ActivityInput): Record<string, Cell> {
  return {
    [H.name]: safeText(a.name),
    [H.from]: toSheetDate(a.from),
    [H.to]: a.to && a.to !== a.from ? toSheetDate(a.to) : '',
    [H.markets]: joinList(a.markets),
    [H.channel]: safeText(a.channel),
    [H.owner]: safeText(a.owner),
    [H.status]: a.status,
    [H.type]: safeText(a.type),
    [H.theme]: safeText(a.theme),
    [H.mechanics]: safeText(a.mechanics),
    [H.code]: safeText(a.code),
    [H.budget]: numCell(a.budget),
    [H.note]: safeText(a.note),
    [H.linkBasecamp]: safeText(a.links.basecamp),
    [H.linkDrive]: safeText(a.links.drive),
    [H.linkGraphics]: safeText(a.links.graphics),
    [H.linkSheet]: safeText(a.links.sheet),
    [H.linkTargito]: safeText(a.links.targito),
    [H.source]: safeText(a.source),
  }
}

export function resultFromRow(row: Row): Result | null {
  const activityId = get(row, RH.activityId)
  if (!activityId) return null
  const rating = parseNumber(get(row, RH.rating))
  return {
    activityId,
    market: get(row, RH.market),
    cost: parseNumber(get(row, RH.cost)),
    revenue: parseNumber(get(row, RH.revenue)),
    orders: parseNumber(get(row, RH.orders)),
    visits: parseNumber(get(row, RH.visits)),
    sent: parseNumber(get(row, RH.sent)),
    openRate: parseNumber(get(row, RH.openRate)),
    ctr: parseNumber(get(row, RH.ctr)),
    grossProfit: parseNumber(get(row, RH.grossProfit)),
    rating: rating != null && rating >= 1 && rating <= 5 ? Math.round(rating) : null,
    lesson: get(row, RH.lesson),
    numbersSource: get(row, RH.numbersSource),
    by: get(row, RH.by),
    at: get(row, RH.at),
  }
}

export function resultToCells(r: ResultInput, activityName: string): Record<string, Cell> {
  return {
    [RH.activityId]: r.activityId,
    [RH.activityName]: safeText(activityName),
    [RH.market]: r.market,
    [RH.cost]: numCell(r.cost),
    [RH.revenue]: numCell(r.revenue),
    [RH.orders]: numCell(r.orders),
    [RH.visits]: numCell(r.visits),
    [RH.sent]: numCell(r.sent),
    [RH.openRate]: numCell(r.openRate),
    [RH.ctr]: numCell(r.ctr),
    [RH.grossProfit]: numCell(r.grossProfit),
    [RH.rating]: r.rating ?? '',
    [RH.lesson]: safeText(r.lesson),
    [RH.numbersSource]: safeText(r.numbersSource),
  }
}

export function competitorFromRow(row: Row): CompetitorAction | null {
  const from = parseDate(get(row, CH.from))
  const competitor = get(row, CH.competitor)
  if (!from || !competitor) return null
  const to = parseDate(get(row, CH.to))
  return {
    id: get(row, CH.id), from, to: to && to >= from ? to : from, competitor, country: get(row, CH.country), channel: get(row, CH.channel),
    what: get(row, CH.what), mechanics: get(row, CH.mechanics), link: get(row, CH.link), source: get(row, CH.source), confidence: get(row, CH.confidence),
  }
}

export function competitorToCells(c: CompetitorInput): Record<string, Cell> {
  return {
    [CH.from]: toSheetDate(c.from), [CH.to]: c.to && c.to !== c.from ? toSheetDate(c.to) : '', [CH.competitor]: safeText(c.competitor),
    [CH.country]: safeText(c.country), [CH.channel]: safeText(c.channel), [CH.what]: safeText(c.what), [CH.mechanics]: safeText(c.mechanics),
    [CH.link]: safeText(c.link), [CH.source]: safeText(c.source), [CH.confidence]: safeText(c.confidence),
  }
}

export function decisionFromRow(row: Row): Decision | null {
  const key = get(row, DH.key)
  if (!key) return null
  return { key, decision: get(row, DH.decision), reason: get(row, DH.reason), until: parseDate(get(row, DH.until)) ?? '', activityId: get(row, DH.activityId) }
}

export function monthlyFromRow(row: Row): MonthlyNumber | null {
  const raw = get(row, MH.month)
  const m = /^(\d{4})-(\d{1,2})$/.exec(raw) ?? /^(\d{4})\/(\d{1,2})$/.exec(raw)
  if (!m) return null
  return {
    month: `${m[1]}-${m[2].padStart(2, '0')}`, market: get(row, MH.market), group: get(row, MH.group), channel: get(row, MH.channel),
    planCost: parseNumber(get(row, MH.planCost)), actualCost: parseNumber(get(row, MH.actualCost)), revenue: parseNumber(get(row, MH.revenue)),
    orders: parseNumber(get(row, MH.orders)),
  }
}

export function calendarFromRow(row: Row): CalendarEntry | null {
  const name = get(row, KH.name)
  const active = get(row, KH.active)
  if (!name || (active !== '' && !isYes(active))) return null
  const from = parseDayMonth(get(row, KH.from))
  const rule = get(row, KH.rule)
  if (!from && !rule) return null
  return { name, kind: get(row, KH.kind) || 'Významný den', from, to: parseDayMonth(get(row, KH.to)), rule, markets: splitList(get(row, KH.markets)), note: get(row, KH.note) }
}

/**
 * The Číselníky sheet holds several lists side by side: a title in the first row, headers in the second,
 * values below. A block is found by its first header, so blocks can move or grow columns.
 */
export function blockRows(matrix: string[][], firstHeader: string): Row[] {
  const headerRow = matrix.findIndex((r) => r.some((c) => norm(c) === norm(firstHeader)))
  if (headerRow < 0) return []
  const start = matrix[headerRow].findIndex((c) => norm(c) === norm(firstHeader))
  const headers: string[] = []
  for (let c = start; c < matrix[headerRow].length && norm(matrix[headerRow][c]) !== ''; c++) headers.push(norm(matrix[headerRow][c]))
  const rows: Row[] = []
  for (let r = headerRow + 1; r < matrix.length; r++) {
    const first = (matrix[r][start] ?? '').trim()
    if (!first) continue
    const row: Row = {}
    headers.forEach((h, i) => { row[h] = (matrix[r][start + i] ?? '').trim() })
    rows.push(row)
  }
  return rows
}

const active = (row: Row, header = 'Aktivní'): boolean => get(row, header) === '' || isYes(get(row, header))

export function listsFromMatrix(matrix: string[][]): Lists {
  const markets = blockRows(matrix, 'Kód').map((r): Market => ({
    code: get(r, 'Kód'), brand: get(r, 'Značka') || get(r, 'Kód'), country: get(r, 'Země'),
    color: /^#[0-9a-f]{6}$/i.test(get(r, 'Barva')) ? get(r, 'Barva') : '#8a817d',
    margin: parseNumber(get(r, 'Hrubá marže (%)')), active: active(r),
  }))
  const channels = blockRows(matrix, 'Kanál').map((r): Channel => {
    const fields = splitList(get(r, 'Pole výsledku')).map((w) => FIELD_WORDS[norm(w)]).filter((f): f is ResultField => !!f)
    return {
      name: get(r, 'Kanál'), group: get(r, 'Skupina') || 'Ostatní', fields: fields.length ? fields : ['cost', 'revenue', 'orders', 'visits'],
      budgetKind: get(r, 'V rozpočtu jako'), leadWeeks: parseNumber(get(r, 'Příprava (týdny)')) ?? 4, active: active(r),
    }
  })
  const groupColors: Record<string, string> = {}
  for (const r of blockRows(matrix, 'Skupina kanálů')) {
    if (/^#[0-9a-f]{6}$/i.test(get(r, 'Barva'))) groupColors[get(r, 'Skupina kanálů')] = get(r, 'Barva')
  }
  return {
    markets,
    channels,
    groupColors,
    statuses: blockRows(matrix, 'Stav').map((r) => get(r, 'Stav')),
    people: blockRows(matrix, 'Jméno').filter((r) => active(r)).map((r) => get(r, 'Jméno')),
    types: blockRows(matrix, 'Typ').map((r) => get(r, 'Typ')),
    competitors: blockRows(matrix, 'Konkurent').map((r): Competitor => ({ name: get(r, 'Konkurent'), country: get(r, 'Země'), watch: isYes(get(r, 'Sledovat')) })),
  }
}

export const marketByCode = (lists: Lists, code: string): Market | undefined => lists.markets.find((m) => norm(m.code) === norm(code))

export const channelByName = (lists: Lists, name: string): Channel | undefined => lists.channels.find((c) => norm(c.name) === norm(name))

export const groupOf = (lists: Lists, channel: string): string => channelByName(lists, channel)?.group ?? 'Ostatní'

export const brandsOf = (lists: Lists, markets: string[]): string[] => {
  const out: string[] = []
  for (const code of markets) {
    const brand = marketByCode(lists, code)?.brand ?? code
    if (!out.includes(brand)) out.push(brand)
  }
  return out
}

/** Colours of the channel groups until the sheet says otherwise. SMS is yellow and Newsletter grey on purpose; the rest are spread around the colour wheel. */
export const DEFAULT_GROUP_COLORS: Record<string, string> = {
  'TV a video': '#0891b2', 'Rádio': '#ea580c', 'OOH': '#16a34a', 'Performance': '#0d9488', 'Display': '#6366f1',
  'Newsletter': '#6b7280', 'SMS': '#eab308', 'Sociální sítě': '#ef4444', 'Web': '#84cc16', 'PR a spolupráce': '#a855f7',
  'Eventy a prodejny': '#b45309', 'Ostatní': '#a8a29e',
}

export const groupColor = (lists: Lists, group: string): string => lists.groupColors[group] ?? DEFAULT_GROUP_COLORS[group] ?? '#8a817d'

export const brandColor = (lists: Lists, brand: string): string => lists.markets.find((m) => m.brand === brand)?.color ?? '#8a817d'

export const allBrands = (lists: Lists): string[] => {
  const out: string[] = []
  for (const m of lists.markets) if (m.active && !out.includes(m.brand)) out.push(m.brand)
  return out
}

export const channelGroups = (lists: Lists): string[] => {
  const out: string[] = []
  for (const c of lists.channels) if (!out.includes(c.group)) out.push(c.group)
  return out
}
