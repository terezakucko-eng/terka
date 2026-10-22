import { domainsByBrand, splitDomain } from './model'

/** 'Růžový Slon: všechny země · Kondomshop: SK' — short enough for a table cell. */
export function domainSummary(domains: string[], allDomains: string[]): string {
  if (domains.length === 0) return ''
  const all = new Map(domainsByBrand(allDomains))
  return domainsByBrand(domains)
    .map(([brand, ds]) => {
      const full = all.get(brand)
      if (full && full.length > 1 && full.every((d) => ds.includes(d))) return `${brand}: vše`
      return `${brand} ${ds.map((d) => splitDomain(d).country).join(' ')}`
    })
    .join(' · ')
}

export function personLine(label: string, by?: { name: string }, at?: number): string | null {
  if (!by || !at) return null
  return `${label} ${by.name}, ${new Date(at).toLocaleString('cs-CZ', { day: 'numeric', month: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`
}

/** 'Havířov, Praha – Quadrio' or 'všechny prodejny'; empty when the item is not store-specific. */
export function storeSummary(stores: string[], allStores: string[]): string {
  if (stores.length === 0) return ''
  if (allStores.length > 1 && allStores.every((s) => stores.includes(s))) return 'všechny prodejny'
  return stores.join(', ')
}
