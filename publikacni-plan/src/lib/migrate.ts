/**
 * Converts documents of the old app (Firestore collections `campaigns` and `yearlyPlans`,
 * rs-publikacni-plan.netlify.app) into the new model.
 */
import { isISODate } from './dates'
import { type AkceInput, type PublikaceInput, SIGNIFICANT_DAY, emptyLinks, uniq } from './model'

export interface OldCampaign {
  id: string
  name?: string
  dateFrom?: string
  dateTo?: string
  channels?: string[]
  countries?: string[]
  description?: string
  status?: string
  basecampLink?: string
  productsLink?: string
  birthSheetLink?: string
  graphicsLink?: string
  smsLink?: string
}

export interface OldYearRow {
  country?: string
  type?: string
  theme?: string
  date?: string
  info?: string
  gift?: string
  significantDay?: string
}

/** One document per year, one map per Czech month name. */
export type OldYearDoc = Record<string, { significantDay?: string; campaigns?: OldYearRow[] } | undefined>

const COUNTRIES = ['CZ', 'SK', 'HU', 'RO', 'SI', 'HR', 'BG']
const RS_ALL = COUNTRIES.map((c) => `Růžový Slon ${c}`)
const BRANDS = ['Růžový Slon', 'Kondomshop', 'Flagranti']

/**
 * The old app wrote domains three ways over time:
 * 'CZ' (until 03/2026, only Růžový Slon existed), 'CZ - Růžový Slon' (01–07/2026), 'Růžový Slon CZ' (since 08/2026).
 */
export function normalizeDomain(raw: string): string | null {
  const s = raw.trim()
  if (COUNTRIES.includes(s)) return `Růžový Slon ${s}`
  const old = /^([A-Z]{2}) - (.+)$/.exec(s)
  if (old && BRANDS.includes(old[2])) return `${old[2]} ${old[1]}`
  const m = /^(.+) ([A-Z]{2})$/.exec(s)
  if (m && BRANDS.includes(m[1])) return s
  return null
}

const CHANNEL_FIX: Record<string, string> = {
  'IG - neplacený post': 'IG - post',
  'IG - influenceři': 'IG - Influenceři',
  'DOPRAVA ZDARMA': 'Doprava zdarma',
  'WEB (A/B, testy, změny, atp.)': 'WEB - A/B testy a změny',
}

export const normalizeChannel = (raw: string): string => CHANNEL_FIX[raw.trim()] ?? raw.trim()

const ENTITIES: Record<string, string> = { nbsp: ' ', amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }

function decodeEntities(s: string): string {
  return s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (all, e: string) => {
    if (e[0] === '#') {
      const code = e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)
      return Number.isFinite(code) ? String.fromCodePoint(code) : all
    }
    return ENTITIES[e.toLowerCase()] ?? all
  })
}

/** The old editor stored pasted HTML; keep the text and the link targets. */
export function htmlToText(raw: string): string {
  if (!raw.includes('<')) return decodeEntities(raw).trim()
  const text = raw
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<a\b[^>]*?href\s*=\s*"+([^"]*)"+[^>]*>([\s\S]*?)<\/a>/gi, (_, href: string, label: string) => {
      const url = href.trim()
      return url ? `${label} (${url})` : label
    })
    .replace(/<li\b[^>]*>/gi, '\n• ')
    .replace(/<(br|\/div|\/p|\/li|\/h\d|\/ul|ul|div|p|h\d)\b[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, '')
  return decodeEntities(text)
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

export interface Migrated<T> {
  id: string
  data: T
}

export function migrateCampaign(c: OldCampaign): Migrated<PublikaceInput> | null {
  if (!c.name?.trim() || !isISODate(c.dateFrom) || !isISODate(c.dateTo)) return null
  const domains = uniq((c.countries ?? []).map(normalizeDomain).filter((d): d is string => d !== null))
  return {
    id: `legacy-${c.id}`,
    data: {
      name: c.name.trim(),
      dateFrom: c.dateFrom <= c.dateTo ? c.dateFrom : c.dateTo,
      dateTo: c.dateFrom <= c.dateTo ? c.dateTo : c.dateFrom,
      channels: uniq((c.channels ?? []).map(normalizeChannel)).sort((a, b) => a.localeCompare(b, 'cs')),
      domains,
      stores: [],
      akceId: null,
      description: htmlToText(c.description ?? ''),
      links: {
        basecamp: c.basecampLink?.trim() ?? '',
        products: c.productsLink?.trim() ?? '',
        birthSheet: c.birthSheetLink?.trim() ?? '',
        graphics: c.graphicsLink?.trim() ?? '',
        sms: c.smsLink?.trim() ?? '',
      },
      ready: false,
      legacyId: c.id,
    },
  }
}

/** '01.11.2025' → '2025-11-01' */
function czToISO(s: string): string | null {
  const m = /^\s*(\d{1,2})\.(\d{1,2})\.(\d{4})\s*$/.exec(s)
  return m ? `${m[3]}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}` : null
}

function yearlyDomains(raw: string): string[] {
  const s = raw.trim()
  if (!s) return []
  if (s === 'Všechny') return RS_ALL
  return uniq(s.split(',').map(normalizeDomain).filter((d): d is string => d !== null))
}

const TYPE_FIX: Record<string, string> = { 'KUPON do objednávek': 'Kupon do objednávek' }

function fnv(s: string): string {
  let h = 0x811c9dc5
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 0x01000193)
  return (h >>> 0).toString(16).padStart(8, '0')
}

/** The old app copied an item spanning several months into each month; the copies collapse into one. */
export function migrateYearly(years: Record<string, OldYearDoc>): Migrated<AkceInput>[] {
  const out = new Map<string, Migrated<AkceInput>>()
  for (const months of Object.values(years)) {
    for (const month of Object.values(months)) {
      for (const r of month?.campaigns ?? []) {
        const [from, to] = (r.date ?? '').split(' - ').map(czToISO)
        const name = (r.theme || r.significantDay || '').trim()
        if (!from || !to || !name) continue
        const key = [r.country ?? '', r.type ?? '', r.theme ?? '', r.date].join('|')
        if (out.has(key)) continue
        const isDay = !!r.significantDay && !r.type
        out.set(key, {
          id: `legacy-${fnv(key)}`,
          data: {
            name,
            type: isDay ? SIGNIFICANT_DAY : TYPE_FIX[r.type?.trim() ?? ''] ?? (r.type?.trim() || 'Hlavní kampaň'),
            dateFrom: from <= to ? from : to,
            dateTo: from <= to ? to : from,
            domains: yearlyDomains(r.country ?? ''),
            stores: [],
            benefit: (r.gift ?? '').trim(),
            info: (r.info ?? '').trim(),
            links: emptyLinks(),
            legacyKey: key,
          },
        })
      }
    }
  }
  return [...out.values()].sort((a, b) => a.data.dateFrom.localeCompare(b.data.dateFrom))
}

/** Domain values the mapping could not place; shown before the import so nothing disappears silently. */
export function unknownDomains(campaigns: OldCampaign[]): string[] {
  return uniq(campaigns.flatMap((c) => c.countries ?? []).filter((d) => normalizeDomain(d) === null))
}
