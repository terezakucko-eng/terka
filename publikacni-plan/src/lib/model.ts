import { type ISODate } from './dates'

export interface Links {
  basecamp: string
  products: string
  birthSheet: string
  graphics: string
  sms: string
}

export const LINK_LABELS: Record<keyof Links, string> = {
  basecamp: 'Basecamp',
  products: 'Soupis produktů',
  birthSheet: 'Rodný list kampaně',
  graphics: 'Grafika (Google disk)',
  sms: 'Nastavení SMS',
}

export const emptyLinks = (): Links => ({ basecamp: '', products: '', birthSheet: '', graphics: '', sms: '' })

export interface Person {
  uid: string
  name: string
  email: string
}

interface Tracked {
  createdAt?: number
  createdBy?: Person
  updatedAt?: number
  updatedBy?: Person
}

/** Concrete output: a newsletter, an IG post, an HP banner… */
export interface Publikace extends Tracked {
  id: string
  name: string
  dateFrom: ISODate
  dateTo: ISODate
  channels: string[]
  domains: string[]
  akceId: string | null
  description: string
  links: Links
  /** Everything is prepared; before the start date the status reads "Ke spuštění". */
  ready: boolean
  legacyId?: string
}

/** Item of the yearly plan: Black Friday, a vendor promo, a coupon, a significant day… */
export interface Akce extends Tracked {
  id: string
  name: string
  type: string
  dateFrom: ISODate
  dateTo: ISODate
  domains: string[]
  benefit: string
  info: string
  links: Links
  legacyKey?: string
}

export type PublikaceInput = Omit<Publikace, 'id' | keyof Tracked>
export type AkceInput = Omit<Akce, 'id' | keyof Tracked>

export interface Lists {
  domains: string[]
  channels: string[]
  akceTypes: string[]
}

export const SIGNIFICANT_DAY = 'Významný den'

export const DEFAULT_LISTS: Lists = {
  domains: [
    'Růžový Slon CZ', 'Růžový Slon SK', 'Růžový Slon HU', 'Růžový Slon RO', 'Růžový Slon SI', 'Růžový Slon HR', 'Růžový Slon BG',
    'Kondomshop CZ', 'Kondomshop SK',
    'Flagranti CZ', 'Flagranti SK',
  ],
  channels: [
    'Newsletter', 'HP Banner', 'SMS', 'Doprava zdarma',
    'IG - post', 'IG - reels', 'IG - stories', 'IG - Influenceři', 'IG - prodejna', 'IG - smyslný dotek', 'IG - kouzlo intimity',
    'Magazín - články', 'Affiliate', 'Referer', 'PPC display', 'Heureka Display', 'Firmy.cz Display', 'Google firmy',
    'WEB - A/B testy a změny', 'Prodejny', 'Eventy', 'Podcasty', 'Rádio', 'TV', 'Billboardy',
  ],
  akceTypes: ['Hlavní kampaň', 'Sekundární kampaň', 'Vendor', 'Kupon do objednávek', SIGNIFICANT_DAY],
}

/** 'Růžový Slon CZ' → { brand: 'Růžový Slon', country: 'CZ' } */
export function splitDomain(domain: string): { brand: string; country: string } {
  const i = domain.lastIndexOf(' ')
  return i < 0 ? { brand: domain, country: '' } : { brand: domain.slice(0, i), country: domain.slice(i + 1) }
}

export const uniq = <T,>(xs: Iterable<T>): T[] => [...new Set(xs)]

export const brandsOf = (domains: string[]): string[] => uniq(domains.map((d) => splitDomain(d).brand))

export const countriesOf = (domains: string[]): string[] => uniq(domains.map((d) => splitDomain(d).country).filter(Boolean))

export type Status = 'priprava' | 'kespusteni' | 'aktivni' | 'ukoncena'

/** Tone is a CSS color; status pills tint it into the surface. */
export const STATUS: Record<Status, { label: string; tone: string }> = {
  priprava: { label: 'V přípravě', tone: 'var(--warn)' },
  kespusteni: { label: 'Ke spuštění', tone: 'var(--info)' },
  aktivni: { label: 'Aktivní', tone: 'var(--ok)' },
  ukoncena: { label: 'Ukončená', tone: 'var(--faint)' },
}

/** The status follows from the dates; only "ready" is set by hand. */
export function statusOf(item: { dateFrom: ISODate; dateTo: ISODate; ready?: boolean }, today: ISODate): Status {
  if (today > item.dateTo) return 'ukoncena'
  if (today >= item.dateFrom) return 'aktivni'
  return item.ready ? 'kespusteni' : 'priprava'
}

/** Domains grouped by brand, in list order. */
export function domainsByBrand(domains: string[]): [string, string[]][] {
  const groups = new Map<string, string[]>()
  for (const d of domains) {
    const { brand } = splitDomain(d)
    groups.set(brand, [...(groups.get(brand) ?? []), d])
  }
  return [...groups]
}
