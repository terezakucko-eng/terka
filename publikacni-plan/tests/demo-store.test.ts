import { describe, expect, it } from 'vitest'
import * as demo from '../src/data/demoStore'
import { emptyLinks, type Person } from '../src/lib/model'

// The preview build swaps ./store for ./demoStore, so both must offer the same API.
type Real = typeof import('../src/data/store')
const api: Real = demo

const by: Person = { uid: 'u', name: 'Test', email: 'test@ruzovyslon.cz' }
const akce = { name: 'Valentýn', type: 'Hlavní kampaň', dateFrom: '2027-02-01', dateTo: '2027-02-14', domains: [], stores: [], benefit: '', info: '', links: emptyLinks() }

describe('demo store', () => {
  it('saves, links and unlinks like the real one', async () => {
    const akceId = await api.saveAkce(akce, null, by)
    const pubId = await api.savePublikace({ name: 'NL', dateFrom: '2027-02-10', dateTo: '2027-02-10', channels: ['Newsletter'], domains: [], stores: ['Havířov'], akceId, description: '', links: emptyLinks(), ready: false }, null, by)
    await api.movePublikace(pubId, '2027-02-12', '2027-02-12', by)
    await api.deleteAkce(akceId, by)
    const all = await api.readEverything()
    expect(all.akce.some((a) => a.id === akceId)).toBe(false)
    expect(all.publikace.find((p) => p.id === pubId)).toMatchObject({ akceId: null, dateFrom: '2027-02-12', stores: ['Havířov'] })
  })

  it('creates only missing documents', async () => {
    const items = [{ id: 'x-1', data: akce }]
    expect(await api.createMissing('akce', items, by)).toBe(1)
    expect(await api.createMissing('akce', items, by)).toBe(0)
  })
})
