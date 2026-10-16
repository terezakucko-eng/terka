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
