import { type Akce, type Publikace, SIGNIFICANT_DAY, splitDomain } from './model'

export interface Filters {
  brands: string[]
  countries: string[]
  channels: string[]
  stores: string[]
  q: string
}

export const EMPTY_FILTERS: Filters = { brands: [], countries: [], channels: [], stores: [], q: '' }

export const hasDomainFilter = (f: Filters): boolean => f.brands.length > 0 || f.countries.length > 0

export const isFiltered = (f: Filters): boolean => hasDomainFilter(f) || f.channels.length > 0 || f.stores.length > 0 || f.q.trim() !== ''

const storesMatch = (stores: string[], f: Filters): boolean => f.stores.length === 0 || stores.some((s) => f.stores.includes(s))

function domainsMatch(domains: string[], f: Filters): boolean {
  if (!hasDomainFilter(f)) return true
  return domains.some((d) => {
    const { brand, country } = splitDomain(d)
    return (f.brands.length === 0 || f.brands.includes(brand)) && (f.countries.length === 0 || f.countries.includes(country))
  })
}

const norm = (s: string): string => s.toLocaleLowerCase('cs').normalize('NFD').replace(/\p{Diacritic}/gu, '')

function textMatch(f: Filters, ...texts: string[]): boolean {
  const q = norm(f.q.trim())
  return q === '' || texts.some((t) => norm(t).includes(q))
}

export function matchPublikace(p: Publikace, f: Filters): boolean {
  return domainsMatch(p.domains, f)
    && storesMatch(p.stores, f)
    && (f.channels.length === 0 || p.channels.some((c) => f.channels.includes(c)))
    && textMatch(f, p.name, p.description)
}

/** Significant days and plan items without a domain belong to everyone, so domain and store filters keep them. */
export function matchAkce(a: Akce, f: Filters): boolean {
  const universal = a.type === SIGNIFICANT_DAY || a.domains.length === 0
  return (universal || (domainsMatch(a.domains, f) && storesMatch(a.stores, f))) && textMatch(f, a.name, a.info, a.benefit)
}
