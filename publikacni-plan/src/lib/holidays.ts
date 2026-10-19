import { addDays, easter, iso, nthWeekday, type ISODate } from './dates'
import { SIGNIFICANT_DAY, type AkceInput, emptyLinks } from './model'

const SUN = 6
const THU = 3

interface Day {
  name: string
  from: ISODate
  to?: ISODate
  domains?: string[]
  info?: string
}

/** Significant days the team plans around, with dates worked out for any year. */
export function significantDays(year: number): AkceInput[] {
  const d = (m: number, day: number) => iso(year, m - 1, day)
  const e = easter(year)
  const thanksgiving = nthWeekday(year, 10, THU, 4)
  const days: Day[] = [
    { name: 'Mezinárodní den objímání', from: d(1, 21) },
    { name: 'Mezinárodní den kondomů', from: d(2, 13), info: 'hlavně Kondomshop' },
    { name: 'Valentýn', from: d(2, 14) },
    { name: 'MDŽ', from: d(3, 8), info: 'v Bulharsku se zároveň slaví Den matek' },
    { name: 'Mezinárodní den štěstí', from: d(3, 20) },
    { name: 'Den matek SI', from: d(3, 25), domains: ['Růžový Slon SI'], info: 'Slovinsko slaví 25. 3.' },
    { name: 'Velikonoce', from: addDays(e, -2), to: addDays(e, 1), info: 'Velký pátek – Velikonoční pondělí' },
    { name: 'Den spodního prádla', from: d(4, 3) },
    { name: '1. máj', from: d(5, 1) },
    { name: 'Den matek HU, RO', from: nthWeekday(year, 4, SUN, 1), domains: ['Růžový Slon HU', 'Růžový Slon RO'], info: '1. neděle v květnu' },
    {
      name: 'Den matek CZ, SK, HR',
      from: nthWeekday(year, 4, SUN, 2),
      domains: ['Růžový Slon CZ', 'Růžový Slon SK', 'Růžový Slon HR', 'Kondomshop CZ', 'Kondomshop SK', 'Flagranti CZ', 'Flagranti SK'],
      info: '2. neděle v květnu',
    },
    { name: 'Měsíc reprodukčního zdraví', from: d(6, 1), to: d(6, 30) },
    { name: 'Den otců', from: nthWeekday(year, 5, SUN, 3), info: '3. neděle v červnu (CZ, SK, HU, SI); HR slaví 19. 3., RO v květnu – ověřte' },
    { name: 'Den líbání', from: d(7, 6) },
    { name: 'Den ženského orgasmu', from: d(8, 8) },
    { name: 'Sexual health day', from: d(9, 4) },
    { name: 'Růžový říjen', from: d(10, 1), to: d(10, 31) },
    { name: 'Den bez podprsenky', from: d(10, 13) },
    { name: 'Den zadků', from: d(10, 15) },
    { name: 'Halloween', from: d(10, 31) },
    { name: 'Movember', from: d(11, 1), to: d(11, 30) },
    { name: 'Den nezadaných', from: d(11, 11) },
    { name: 'Den sebevědomí', from: d(11, 13) },
    { name: `Black Friday ${year}`, from: addDays(thanksgiving, 1) },
    { name: `Cyber Monday ${year}`, from: addDays(thanksgiving, 4) },
    { name: 'Den boje proti AIDS', from: d(12, 1) },
    { name: 'Vánoce', from: d(12, 24), to: d(12, 26) },
  ]
  return days.map((x) => ({
    name: x.name,
    type: SIGNIFICANT_DAY,
    dateFrom: x.from,
    dateTo: x.to ?? x.from,
    domains: x.domains ?? [],
    benefit: '',
    info: x.info ?? '',
    links: emptyLinks(),
  }))
}

/** Stable document id, so adding the same day twice finds the existing one. */
export function significantDayId(d: { name: string; dateFrom: ISODate }): string {
  const slug = d.name.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/[^a-z0-9]+/g, '-')
  return `den-${d.dateFrom}-${slug}`
}
