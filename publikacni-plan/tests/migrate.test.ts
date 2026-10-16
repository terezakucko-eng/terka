import { describe, expect, it } from 'vitest'
import { htmlToText, migrateCampaign, migrateYearly, normalizeChannel, normalizeDomain, unknownDomains } from '../src/lib/migrate'
import { SIGNIFICANT_DAY } from '../src/lib/model'

describe('normalizeDomain', () => {
  it('maps all three historic formats', () => {
    expect(normalizeDomain('CZ')).toBe('Růžový Slon CZ')
    expect(normalizeDomain('HU - Růžový Slon')).toBe('Růžový Slon HU')
    expect(normalizeDomain('SK - Kondomshop')).toBe('Kondomshop SK')
    expect(normalizeDomain('Flagranti CZ')).toBe('Flagranti CZ')
    expect(normalizeDomain('Mars')).toBeNull()
  })
})

describe('normalizeChannel', () => {
  it('merges spelling variants and drops commas', () => {
    expect(normalizeChannel('DOPRAVA ZDARMA')).toBe('Doprava zdarma')
    expect(normalizeChannel('IG - neplacený post')).toBe('IG - post')
    expect(normalizeChannel('WEB (A/B, testy, změny, atp.)')).not.toContain(',')
    expect(normalizeChannel('Newsletter')).toBe('Newsletter')
  })
})

describe('htmlToText', () => {
  it('keeps text, line breaks and link targets', () => {
    const html = '<!--StartFragment-->FLASH SALE -&nbsp;<strong>sleva 50 %</strong><br><a href=""https://x.cz/a/"">Pride</a><div>Kondomy</div><ul><li>jedna</li></ul>'
    expect(htmlToText(html)).toBe('FLASH SALE - sleva 50 %\nPride (https://x.cz/a/)\nKondomy\n\n• jedna')
    expect(htmlToText('Sleva &amp; dárek')).toBe('Sleva & dárek')
  })
})

describe('migrateCampaign', () => {
  it('converts an old campaign', () => {
    const m = migrateCampaign({
      id: 'abc', name: ' Valentýn NL ', dateFrom: '2026-02-01', dateTo: '2026-02-01',
      channels: ['Newsletter', 'IG - influenceři'], countries: ['CZ', 'CZ - Růžový Slon', 'SK - Kondomshop'],
      description: 'text', status: 'ukoncena', graphicsLink: 'https://drive.google.com/x',
    })
    expect(m?.id).toBe('legacy-abc')
    expect(m?.data).toMatchObject({
      name: 'Valentýn NL', channels: ['IG - Influenceři', 'Newsletter'], domains: ['Růžový Slon CZ', 'Kondomshop SK'],
      akceId: null, ready: false, legacyId: 'abc',
    })
    expect(m?.data.links.graphics).toBe('https://drive.google.com/x')
  })

  it('skips campaigns without a name or dates and swaps reversed dates', () => {
    expect(migrateCampaign({ id: 'x', name: '', dateFrom: '2026-01-01', dateTo: '2026-01-02' })).toBeNull()
    expect(migrateCampaign({ id: 'x', name: 'A', dateFrom: 'bad', dateTo: '2026-01-02' })).toBeNull()
    expect(migrateCampaign({ id: 'x', name: 'A', dateFrom: '2026-01-05', dateTo: '2026-01-02' })?.data).toMatchObject({ dateFrom: '2026-01-02', dateTo: '2026-01-05' })
  })

  it('reports domains it cannot place', () => {
    expect(unknownDomains([{ id: 'a', countries: ['CZ', 'Mars'] }])).toEqual(['Mars'])
  })
})

describe('migrateYearly', () => {
  const summer = { type: 'Hlavní kampaň', country: 'CZ, SK', theme: 'Šťavnaté léto', date: '31.07.2026 - 31.08.2026', gift: 'ANO', info: '' }
  const years = {
    '2026': {
      'ČERVENEC': { significantDay: '', campaigns: [summer, { type: '', country: '', theme: 'Den líbání', significantDay: 'Den líbání', date: '06.07.2026 - 06.07.2026' }] },
      'SRPEN': { significantDay: '', campaigns: [summer] },
      'PROSINEC': { campaigns: [{ type: 'KUPON do objednávek', country: 'Všechny', theme: 'Sleva 20 %', date: '01.12.2026 - 31.12.2026' }] },
    },
  }

  it('collapses month copies and maps types and domains', () => {
    const out = migrateYearly(years)
    expect(out).toHaveLength(3)
    const [day, leto, kupon] = out
    expect(day.data).toMatchObject({ name: 'Den líbání', type: SIGNIFICANT_DAY, domains: [], dateFrom: '2026-07-06' })
    expect(leto.data).toMatchObject({ name: 'Šťavnaté léto', domains: ['Růžový Slon CZ', 'Růžový Slon SK'], benefit: 'ANO', dateTo: '2026-08-31' })
    expect(kupon.data.type).toBe('Kupon do objednávek')
    expect(kupon.data.domains).toHaveLength(7)
  })

  it('gives stable ids so a repeated import finds the same documents', () => {
    expect(migrateYearly(years).map((m) => m.id)).toEqual(migrateYearly(years).map((m) => m.id))
  })
})
