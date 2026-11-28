import { addDays, toSheetDate, todayISO, type ISODate } from '../lib/dates'
import { CH, DEFAULT_GROUP_COLORS, H, KH, MH, RH, SHEET } from '../lib/model'
import { type Cell } from '../lib/parse'
import { type SheetsApi } from './sheets'

/**
 * A small spreadsheet kept in memory. It answers like Google Sheets does (typed values in, displayed text out),
 * which makes it both the test double for the data layer and the example data the page can show without a connection.
 */
export class MemorySheets implements SheetsApi {
  readonly sheets = new Map<string, Cell[][]>()
  calls = 0

  constructor(seed: Record<string, Cell[][]> = {}) {
    for (const [name, rows] of Object.entries(seed)) this.sheets.set(name, rows.map((r) => [...r]))
  }

  private parse(range: string): { grid: Cell[][]; c1: number; r1: number; c2: number; r2: number } {
    const m = /^(?:'((?:[^']|'')+)'|([^!]+))!([A-Z]+)(\d+)?:([A-Z]+)(\d+)?$/.exec(range)
    if (!m) throw new Error(`Bad range: ${range}`)
    const name = (m[1] ?? m[2]).replace(/''/g, "'")
    if (!this.sheets.has(name)) this.sheets.set(name, [])
    const col = (s: string) => [...s].reduce((n, ch) => n * 26 + ch.charCodeAt(0) - 64, 0) - 1
    return { grid: this.sheets.get(name)!, c1: col(m[3]), r1: Number(m[4] ?? 1) - 1, c2: col(m[5]), r2: m[6] ? Number(m[6]) - 1 : 99999 }
  }

  async getValues(range: string): Promise<string[][]> {
    this.calls++
    const { grid, c1, r1, c2, r2 } = this.parse(range)
    const rows: string[][] = []
    for (let r = r1; r <= Math.min(r2, grid.length - 1); r++) {
      const row = (grid[r] ?? []).slice(c1, c2 + 1).map(show)
      while (row.length && row[row.length - 1] === '') row.pop()
      rows.push(row)
    }
    while (rows.length && rows[rows.length - 1].length === 0) rows.pop()
    return rows
  }

  async updateValues(range: string, values: Cell[][]): Promise<void> {
    this.calls++
    const { grid, c1, r1 } = this.parse(range)
    values.forEach((row, i) => {
      while (grid.length <= r1 + i) grid.push([])
      row.forEach((cell, j) => {
        if (cell === null || cell === undefined) return
        const target = grid[r1 + i]
        while (target.length <= c1 + j) target.push('')
        target[c1 + j] = enter(cell)
      })
    })
  }
}

/** What the sheet keeps when something is typed in: numbers become numbers, a leading apostrophe forces text. */
function enter(cell: Cell): Cell {
  if (typeof cell !== 'string') return cell
  if (cell.startsWith("'")) return cell.slice(1)
  if (/^-?\d+([.,]\d+)?$/.test(cell)) return Number(cell.replace(',', '.'))
  return cell
}

/** What the sheet displays: Czech number formatting, nothing for zero. */
function show(cell: Cell): string {
  if (cell == null) return ''
  if (typeof cell === 'number') {
    if (cell === 0) return ''
    return new Intl.NumberFormat('cs-CZ', { maximumFractionDigits: 2 }).format(cell)
  }
  if (typeof cell === 'boolean') return cell ? 'TRUE' : 'FALSE'
  return cell
}

const ACT_HEADERS = [H.name, H.from, H.to, H.markets, H.channel, H.owner, H.status, H.type, H.theme, H.mechanics, H.code, H.budget, H.note,
  H.linkBasecamp, H.linkDrive, H.linkGraphics, H.linkSheet, H.linkTargito, H.id, H.createdBy, H.createdAt, H.updatedBy, H.updatedAt, H.source]
const RES_HEADERS = [RH.activityId, RH.activityName, RH.market, RH.cost, RH.revenue, RH.orders, RH.visits, RH.sent, RH.openRate, RH.ctr, RH.grossProfit,
  RH.rating, RH.lesson, RH.numbersSource, RH.by, RH.at, RH.profit]

const LISTS: Cell[][] = (() => {
  const markets: Cell[][] = [
    ['RS CZ', 'Růžový slon', 'CZ', '#e0077d', 64.4], ['RS SK', 'Růžový slon', 'SK', '#e0077d', 61.3], ['RS HU', 'Růžový slon', 'HU', '#e0077d', 48.2],
    ['RS RO', 'Růžový slon', 'RO', '#e0077d', 43.9], ['RS SI', 'Růžový slon', 'SI', '#e0077d', 50.6], ['RS HR', 'Růžový slon', 'HR', '#e0077d', 50.5],
    ['RS BG', 'Růžový slon', 'BG', '#e0077d', 42.8], ['RS prodejny', 'Růžový slon', 'prodejny', '#e0077d', ''], ['KS CZ', 'Kondomshop', 'CZ', '#2563eb', 46.2],
    ['KS SK', 'Kondomshop', 'SK', '#2563eb', 46.6], ['Flagranti CZ', 'Flagranti', 'CZ', '#7c3aed', ''], ['Flagranti SK', 'Flagranti', 'SK', '#7c3aed', ''],
  ]
  const brand = 'náklad, návštěvy', perf = 'náklad, tržby, objednávky, návštěvy', crm = 'odesláno, open rate, CTR, náklad, tržby, objednávky', web = 'návštěvy, tržby, objednávky'
  const channels: Cell[][] = [
    ['TV Nova', 'TV a video', brand, 8], ['ONEPLAY', 'TV a video', brand, 6], ['Markíza', 'TV a video', brand, 8], ['Kino', 'TV a video', brand, 6],
    ['Rádio', 'Rádio', brand, 4], ['Billboardy', 'OOH', brand, 6], ['CLV', 'OOH', brand, 6],
    ['Google Ads', 'Performance', perf, 2], ['Sklik', 'Performance', perf, 2], ['Heureka', 'Performance', perf, 2], ['Zboží', 'Performance', perf, 2],
    ['Srovnávače', 'Performance', perf, 2], ['Affiliate', 'Performance', perf, 2], ['Heureka bannery', 'Display', brand, 3], ['Firmy.cz', 'Display', brand, 3],
    ['Newsletter', 'Newsletter', crm, 1], ['SMS', 'SMS', crm, 1],
    ['Instagram post', 'Sociální sítě', perf, 2], ['Instagram reels', 'Sociální sítě', perf, 2], ['Instagram stories', 'Sociální sítě', perf, 2],
    ['Influenceři', 'Sociální sítě', perf, 4], ['TikTok', 'Sociální sítě', perf, 2], ['LinkedIn', 'Sociální sítě', perf, 2],
    ['Banner na úvodní stránce', 'Web', web, 2], ['Magazín a články', 'Web', web, 2], ['A/B testy', 'Web', web, 2], ['Doprava zdarma', 'Web', web, 2],
    ['Podcasty', 'PR a spolupráce', perf, 4], ['Články', 'PR a spolupráce', perf, 4], ['Partnerství', 'PR a spolupráce', perf, 6],
    ['Eventy', 'Eventy a prodejny', 'náklad, tržby, objednávky', 8], ['Prodejny', 'Eventy a prodejny', 'náklad, tržby, objednávky', 4],
  ]
  const statuses = ['Nápad', 'V přípravě', 'Schváleno', 'Běží', 'Hotovo', 'Vyhodnoceno', 'Zrušeno']
  const people = ['Tereza Kucková', 'Kolegyně z marketingu']
  const types = ['Hlavní kampaň', 'Sekundární kampaň', 'Vendor akce', 'Kupon do objednávek', 'Běžná komunikace', 'Event', 'Spolupráce']
  const rivals: Cell[][] = [['eroticcity.cz', 'CZ', 'ano'], ['yoo.cz', 'CZ', 'ano'], ['superlove.sk', 'SK', 'ano'], ['superlove.hu', 'HU', 'ano']]
  const rows: Cell[][] = [
    ['ZNAČKY A ZEMĚ', '', '', '', '', '', '', '', '', 'KANÁLY', '', '', '', '', '', '', '', 'STAVY', '', '', 'ODPOVĚDNÍ', '', '', 'TYPY', '', 'KONKURENTI', '', '', '', '', 'BARVY SKUPIN KANÁLŮ'],
    ['Kód', 'Značka', 'Země', 'Barva', 'Hrubá marže (%)', 'Trh v Avengers', 'V rozpočtu', 'Aktivní', '', 'Kanál', 'Skupina', 'Pole výsledku', 'Účty v rozpočtu',
      'V rozpočtu jako', 'Příprava (týdny)', 'Aktivní', '', 'Stav', 'Jak se nastavuje', '', 'Jméno', 'Aktivní', '', 'Typ', '', 'Konkurent', 'Země', 'Ke značce', 'Sledovat', '', 'Skupina kanálů', 'Barva'],
  ]
  const groups = Object.entries(DEFAULT_GROUP_COLORS)
  const n = Math.max(markets.length, channels.length, statuses.length, types.length, rivals.length, groups.length)
  for (let i = 0; i < n; i++) {
    const m = markets[i], c = channels[i], k = rivals[i]
    rows.push([
      ...(m ? [m[0], m[1], m[2], m[3], m[4], '', '', 'ano'] : ['', '', '', '', '', '', '', '']), '',
      ...(c ? [c[0], c[1], c[2], '', '', c[3], 'ano'] : ['', '', '', '', '', '', '']), '',
      statuses[i] ?? '', '', '', people[i] ?? '', people[i] ? 'ano' : '', '', types[i] ?? '', '',
      ...(k ? [k[0], k[1], '', k[2]] : ['', '', '', '']), '',
      ...(groups[i] ?? ['', '']),
    ])
  }
  return rows
})()

const CALENDAR: Cell[][] = [
  [KH.name, KH.kind, KH.from, KH.to, KH.rule, KH.markets, KH.note, KH.active],
  ['Novoroční slevy', 'Akce', '1. 1.', '18. 1.', '', '', '', 'ano'], ['Mezinárodní den objímání', 'Významný den', '21. 1.', '', '', '', '', 'ano'],
  ['Valentýn', 'Akce', '26. 1.', '14. 2.', '', '', '', 'ano'], ['MDŽ', 'Významný den', '8. 3.', '', '', '', '', 'ano'],
  ['Velikonoce', 'Akce', '', '', 'Velikonoce', '', '', 'ano'], ['Den matek CZ, SK, HR', 'Významný den', '', '', '2. neděle v květnu', 'RS CZ, RS SK, RS HR', '', 'ano'],
  ['Měsíc reprodukčního zdraví', 'Sezóna', '1. 6.', '30. 6.', '', '', '', 'ano'], ['Den líbání', 'Významný den', '6. 7.', '', '', '', '', 'ano'],
  ['Růžový říjen', 'Sezóna', '1. 10.', '31. 10.', '', '', '', 'ano'], ['Halloween', 'Významný den', '31. 10.', '', '', '', '', 'ano'],
  ['Black Friday', 'Akce', '1. 11.', '30. 11.', 'Black Friday', '', '', 'ano'], ['Cyber Monday', 'Významný den', '', '', 'Cyber Monday', '', '', 'ano'],
  ['Den boje proti AIDS', 'Významný den', '1. 12.', '', '', '', '', 'ano'], ['Vánoce', 'Akce', '1. 12.', '24. 12.', '', '', '', 'ano'],
  ['Povánoční výprodej', 'Akce', '25. 12.', '31. 12.', '', '', '', 'ano'],
]

/** Example plan around today, so every screen has something to show. Names say plainly that these are examples. */
export function exampleSeed(today: ISODate = todayISO()): Record<string, Cell[][]> {
  return copySeed(buildExample(today))
}

/** Every call hands out its own rows, so nobody can change the shared headers by accident. */
function copySeed(seed: Record<string, Cell[][]>): Record<string, Cell[][]> {
  return Object.fromEntries(Object.entries(seed).map(([name, rows]) => [name, rows.map((r) => [...r])]))
}

function buildExample(today: ISODate): Record<string, Cell[][]> {
  const d = (offset: number) => toSheetDate(addDays(today, offset))
  const all = 'RS CZ, RS SK, RS HU, RS RO, RS SI, RS HR, RS BG'
  const act = (id: string, name: string, from: number, to: number | null, markets: string, channel: string, status: string, theme: string, budget: number | '', type = 'Hlavní kampaň', code = ''): Cell[] =>
    [name, d(from), to == null ? '' : d(to), markets, channel, 'Tereza Kucková', status, type, theme, '', code, budget, '', '', '', '', '', '', id, 'Ukázka', '', '', '', 'ukázka']
  const activities: Cell[][] = [
    ACT_HEADERS,
    act('U-01', 'Příklad: TV Nova, spot Podzimní akce', -52, -32, 'RS CZ', 'TV Nova', 'Schváleno', 'Podzimní akce', 1_800_000),
    act('U-02', 'Příklad: newsletter Podzimní akce', -50, null, 'RS CZ, RS SK', 'Newsletter', 'Schváleno', 'Podzimní akce', 3_000, 'Hlavní kampaň', 'PODZIM'),
    act('U-03', 'Příklad: SMS Podzimní akce', -48, null, 'RS CZ, RS SK', 'SMS', 'Schváleno', 'Podzimní akce', 130_000, 'Hlavní kampaň', 'PODZIM'),
    act('U-04', 'Příklad: influenceři Podzimní akce', -45, -35, 'RS CZ', 'Influenceři', 'Schváleno', 'Podzimní akce', 60_000),
    act('U-05', 'Příklad: billboardy Praha a Brno', -30, -2, 'RS CZ', 'Billboardy', 'Schváleno', '', 240_000, 'Běžná komunikace'),
    act('U-06', 'Příklad: newsletter Novinky měsíce', -12, null, 'KS CZ, KS SK', 'Newsletter', 'Schváleno', '', '', 'Běžná komunikace'),
    act('U-07', 'Příklad: rádio, týdenní kampaň', -6, 4, 'RS CZ', 'Rádio', 'Schváleno', '', 190_000, 'Sekundární kampaň'),
    act('U-08', 'Příklad: banner na úvodní stránce', -3, 9, all, 'Banner na úvodní stránce', 'Schváleno', '', '', 'Běžná komunikace'),
    act('U-09', 'Příklad: SMS připomínka akce', 2, null, 'RS CZ, RS SK', 'SMS', 'Schváleno', '', 110_000, 'Sekundární kampaň'),
    act('U-10', 'Příklad: Instagram reels s tipy', 5, null, 'RS CZ', 'Instagram reels', 'V přípravě', '', '', 'Běžná komunikace'),
    act('U-11', 'Příklad: newsletter Flagranti', 8, null, 'Flagranti CZ, Flagranti SK', 'Newsletter', 'V přípravě', '', '', 'Běžná komunikace'),
    act('U-12', 'Příklad: event v prodejně Chodov', 16, 17, 'RS prodejny', 'Eventy', 'Nápad', '', 45_000, 'Event'),
    act('U-13', 'Příklad: Markíza, zimní spot', 20, 45, 'RS SK', 'Markíza', 'Nápad', '', 300_000),
    act('U-14', 'Příklad: zrušený podcast', -20, null, 'RS CZ', 'Podcasty', 'Zrušeno', '', 25_000, 'Spolupráce'),
  ]
  const res = (id: string, name: string, cost: number | '', revenue: number | '', orders: number | '', visits: number | '', sent: number | '', open: number | '', ctr: number | '', gp: number | '', rating: number | '', lesson: string): Cell[] =>
    [id, name, '', cost, revenue, orders, visits, sent, open, ctr, gp, rating, lesson, 'ukázka', 'Ukázka', d(-1), gp === '' ? '' : gp - (cost || 0)]
  const results: Cell[][] = [
    RES_HEADERS,
    res('U-01', 'Příklad: TV Nova, spot Podzimní akce', 1_790_000, '', '', 42_000, '', '', '', '', 3, 'Kratší spot, víc opakování.'),
    res('U-02', 'Příklad: newsletter Podzimní akce', 2_700, 148_000, 132, 5_400, 196_000, 26.4, 1.6, 94_000, 4, 'Poslat ráno, ne po obědě.'),
    res('U-03', 'Příklad: SMS Podzimní akce', 120_000, 600_000, 540, 13_000, 150_000, '', '', 380_000, 5, 'Poslat o den dřív.'),
    res('U-04', 'Příklad: influenceři Podzimní akce', 61_000, 52_000, 44, 3_100, '', '', '', 33_000, 2, 'Méně jmen, delší spolupráce.'),
  ]
  const competitors: Cell[][] = [
    [CH.from, CH.to, CH.competitor, CH.country, CH.channel, CH.what, CH.mechanics, CH.link, CH.source, CH.confidence, CH.by, CH.at, CH.id],
    [d(-9), d(1), 'eroticcity.cz', 'CZ', 'Banner na úvodní stránce', 'Příklad: výprodej skladu', 'slevy až 50 %', '', 'ukázka', 'střední', 'Ukázka', '', 'K-U1'],
    [d(3), d(6), 'superlove.sk', 'SK', 'Newsletter', 'Příklad: doprava zdarma na víkend', 'doprava zdarma', '', 'ukázka', 'nízká', 'Ukázka', '', 'K-U2'],
  ]
  const month = today.slice(0, 7)
  return {
    [SHEET.lists]: LISTS,
    [SHEET.calendar]: CALENDAR,
    [SHEET.activities]: activities,
    [SHEET.results]: results,
    [SHEET.competitors]: competitors,
    [SHEET.decisions]: [['Klíč', 'Rozhodnutí', 'Důvod', 'Odložit do', 'ID aktivity', 'Kdo', 'Kdy']],
    [SHEET.monthly]: [
      [MH.month, MH.market, MH.group, MH.channel, MH.planCost, MH.actualCost, MH.revenue, MH.orders, MH.margin, MH.source, 'Aktualizováno'],
      [month, 'RS CZ', 'Rádio', 'Rádio', 200_000, 190_000, '', '', '', 'ukázka', ''],
      [month, 'RS CZ', 'OOH', 'Billboardy', 250_000, 240_000, '', '', '', 'ukázka', ''],
    ],
  }
}

/** The empty spreadsheet as the app expects it: headers and lists, no activities. */
export function emptySeed(): Record<string, Cell[][]> {
  const seed = exampleSeed()
  return copySeed({ ...seed, [SHEET.activities]: [ACT_HEADERS], [SHEET.results]: [RES_HEADERS], [SHEET.competitors]: [seed[SHEET.competitors][0]], [SHEET.monthly]: [seed[SHEET.monthly][0]] })
}
