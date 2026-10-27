import { describe, expect, it } from 'vitest'
import { EMPTY_FILTERS, matchAkce, matchPublikace } from '../src/lib/filters'
import { significantDays } from '../src/lib/holidays'
import { type Akce, type Publikace, SIGNIFICANT_DAY, brandsOf, emptyLinks, splitDomain, statusOf } from '../src/lib/model'

const pub = (over: Partial<Publikace> = {}): Publikace => ({
  id: 'p', name: 'Newsletter Valentýn', dateFrom: '2027-02-01', dateTo: '2027-02-14', channels: ['Newsletter'],
  domains: ['Růžový Slon CZ'], stores: [], akceId: null, description: '', links: emptyLinks(), ready: false, ...over,
})

const akce = (over: Partial<Akce> = {}): Akce => ({
  id: 'a', name: 'Valentýn', type: 'Hlavní kampaň', dateFrom: '2027-02-01', dateTo: '2027-02-14',
  domains: ['Kondomshop SK'], stores: [], benefit: '', info: '', links: emptyLinks(), ...over,
})

describe('status', () => {
  it('follows the dates, with "ready" before the start', () => {
    const p = pub()
    expect(statusOf(p, '2027-01-20')).toBe('priprava')
    expect(statusOf({ ...p, ready: true }, '2027-01-20')).toBe('kespusteni')
    expect(statusOf(p, '2027-02-01')).toBe('aktivni')
    expect(statusOf(p, '2027-02-14')).toBe('aktivni')
    expect(statusOf(p, '2027-02-15')).toBe('ukoncena')
  })
})

describe('domains', () => {
  it('splits brand and country', () => {
    expect(splitDomain('Růžový Slon CZ')).toEqual({ brand: 'Růžový Slon', country: 'CZ' })
    expect(brandsOf(['Růžový Slon CZ', 'Růžový Slon SK', 'Flagranti CZ'])).toEqual(['Růžový Slon', 'Flagranti'])
  })
})

describe('filters', () => {
  it('combines brand and country on the same domain', () => {
    const p = pub({ domains: ['Růžový Slon CZ', 'Kondomshop SK'] })
    expect(matchPublikace(p, { ...EMPTY_FILTERS, brands: ['Kondomshop'] })).toBe(true)
    expect(matchPublikace(p, { ...EMPTY_FILTERS, brands: ['Kondomshop'], countries: ['CZ'] })).toBe(false)
    expect(matchPublikace(p, { ...EMPTY_FILTERS, countries: ['SK'] })).toBe(true)
  })

  it('filters channels and searches without diacritics', () => {
    expect(matchPublikace(pub(), { ...EMPTY_FILTERS, channels: ['SMS'] })).toBe(false)
    expect(matchPublikace(pub(), { ...EMPTY_FILTERS, q: 'valentyn' })).toBe(true)
  })

  it('filters by store and keeps items for any of the chosen stores', () => {
    const p = pub({ stores: ['Havířov', 'Praha – Quadrio'] })
    expect(matchPublikace(p, { ...EMPTY_FILTERS, stores: ['Havířov'] })).toBe(true)
    expect(matchPublikace(p, { ...EMPTY_FILTERS, stores: ['Brno – Melody Mall'] })).toBe(false)
    expect(matchPublikace(pub(), { ...EMPTY_FILTERS, stores: ['Havířov'] })).toBe(false)
    expect(matchAkce(akce({ type: SIGNIFICANT_DAY }), { ...EMPTY_FILTERS, stores: ['Havířov'] })).toBe(true)
  })

  it('keeps significant days under any domain filter', () => {
    const f = { ...EMPTY_FILTERS, brands: ['Flagranti'] }
    expect(matchAkce(akce(), f)).toBe(false)
    expect(matchAkce(akce({ type: SIGNIFICANT_DAY }), f)).toBe(true)
    expect(matchAkce(akce({ domains: [] }), f)).toBe(true)
  })
})

describe('significant days', () => {
  it('works out the 2027 dates', () => {
    const days = Object.fromEntries(significantDays(2027).map((d) => [d.name, d]))
    expect(days['Velikonoce']).toMatchObject({ dateFrom: '2027-03-26', dateTo: '2027-03-29' })
    expect(days['Den matek CZ, SK, HR'].dateFrom).toBe('2027-05-09')
    expect(days['Den matek HU, RO'].dateFrom).toBe('2027-05-02')
    expect(days['Den otců'].dateFrom).toBe('2027-06-20')
    expect(days['Black Friday 2027'].dateFrom).toBe('2027-11-26')
    expect(days['Cyber Monday 2027'].dateFrom).toBe('2027-11-29')
    expect(significantDays(2027).every((d) => d.type === SIGNIFICANT_DAY && d.dateFrom <= d.dateTo)).toBe(true)
  })
})
