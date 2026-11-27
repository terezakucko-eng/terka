import { describe, expect, it } from 'vitest'
import { findValues } from '../src/data/mcpApi'
import { emptySeed, exampleSeed, MemorySheets } from '../src/data/mockApi'
import { Store } from '../src/data/store'
import { type SheetsApi } from '../src/data/sheets'
import { STATUS, type ActivityInput } from '../src/lib/model'
import { totals, resultsById } from '../src/lib/stats'

const input = (over: Partial<ActivityInput> = {}): ActivityInput => ({
  name: 'SMS Black Friday', from: '2026-11-04', to: '2026-11-04', markets: ['RS CZ', 'RS SK'], channel: 'SMS', owner: 'Tereza Kucková', status: STATUS.approved,
  type: '', theme: 'Black Friday', mechanics: 'až −69 %', code: 'BLACK', budget: 132493, note: '', links: { basecamp: '', drive: '', graphics: '', sheet: '', targito: '' }, source: '', ...over,
})

describe('store over a spreadsheet', () => {
  it('reads the example plan', async () => {
    const data = await new Store(new MemorySheets(exampleSeed('2026-11-27')), () => 'Test').load()
    expect(data.activities).toHaveLength(14)
    expect(data.activities[2]).toMatchObject({ id: 'U-03', channel: 'SMS', from: '2026-10-10', budget: 130000, markets: ['RS CZ', 'RS SK'] })
    expect(totals(resultsById(data.results).get('U-03')!)).toMatchObject({ cost: 120000, grossProfit: 380000, profit: 260000, rating: 5 })
    expect(data.calendar.length).toBeGreaterThan(10)
    expect(data.competitors).toHaveLength(2)
    expect(data.monthly).toHaveLength(2)
    expect(data.warnings).toEqual([])
  })

  it('creates, edits, changes status and deletes softly', async () => {
    const api = new MemorySheets(emptySeed())
    const store = new Store(api, () => 'Tereza')
    await store.load()
    const [id1, id2] = await store.createActivities([input(), input({ name: 'Newsletter Black Friday', channel: 'Newsletter', budget: null })])
    let data = await store.load()
    expect(data.activities.map((a) => a.id)).toEqual([id1, id2])
    expect(data.activities[0]).toMatchObject({ name: 'SMS Black Friday', code: 'BLACK', budget: 132493, mechanics: 'až −69 %' })
    expect(api.sheets.get('Aktivity')![1][19]).toBe('Tereza')

    await store.updateActivity(id2, input({ name: 'Newsletter BF, verze 2', channel: 'Newsletter', to: '2026-11-06' }))
    await store.setStatus([id1], STATUS.cancelled)
    data = await store.load()
    expect(data.activities.find((a) => a.id === id2)).toMatchObject({ name: 'Newsletter BF, verze 2', to: '2026-11-06' })
    expect(data.activities.find((a) => a.id === id1)!.status).toBe('Zrušeno')
    // the creation stamp survives an edit
    expect(api.sheets.get('Aktivity')![2][19]).toBe('Tereza')

    await store.remove([id1, id2])
    data = await store.load()
    expect(data.activities.every((a) => a.status === 'Smazáno')).toBe(true)
    expect(api.sheets.get('Aktivity')).toHaveLength(3)
  })

  it('finds rows by id even after the sheet was re-sorted by hand', async () => {
    const api = new MemorySheets(emptySeed())
    const store = new Store(api, () => 'T')
    await store.load()
    const [a, b] = await store.createActivities([input({ name: 'První' }), input({ name: 'Druhá' })])
    const grid = api.sheets.get('Aktivity')!
    ;[grid[1], grid[2]] = [grid[2], grid[1]]
    await store.updateActivity(a, input({ name: 'První po úpravě' }))
    const data = await store.load()
    expect(data.activities.find((x) => x.id === a)!.name).toBe('První po úpravě')
    expect(data.activities.find((x) => x.id === b)!.name).toBe('Druhá')
  })

  it('saves a result once and rewrites it on the second save', async () => {
    const api = new MemorySheets(emptySeed())
    const store = new Store(api, () => 'T')
    await store.load()
    const [id] = await store.createActivities([input()])
    const activity = (await store.load()).activities[0]
    const result = { activityId: id, market: '', cost: 132493, revenue: 656453, orders: null, visits: null, sent: 157788, openRate: null, ctr: null, grossProfit: 396748, rating: 4, lesson: 'Poslat o den dřív.', numbersSource: '' }
    await store.saveResult(activity, result)
    await store.saveResult(activity, { ...result, rating: 5 })
    await store.saveResult(activity, { ...result, market: 'RS SK', cost: 13737, grossProfit: 41170, rating: null, lesson: '' })
    const data = await store.load()
    expect(data.results).toHaveLength(2)
    expect(data.results[0]).toMatchObject({ rating: 5, cost: 132493 })
    expect(data.results[1]).toMatchObject({ market: 'RS SK', cost: 13737 })
  })

  it('gives an id to rows typed straight into the sheet', async () => {
    const api = new MemorySheets(emptySeed())
    api.sheets.get('Aktivity')!.push(['Ručně přidaná', '5. 12. 2026', '', 'KS CZ', 'Newsletter', 'Tereza Kucková', 'Nápad'])
    const store = new Store(api, () => 'T')
    const first = await store.load()
    expect(first.activities[0].id).toMatch(/^A-/)
    const second = await store.load()
    expect(second.activities[0].id).toBe(first.activities[0].id)
  })

  it('says which column is missing', async () => {
    const seed = emptySeed()
    seed['Aktivity'][0][1] = 'Začátek'
    await expect(new Store(new MemorySheets(seed), () => 'T').load()).rejects.toThrow('chybí sloupec „Datum od“')
  })

  it('writes plain text for anything that looks like a formula', async () => {
    const api = new MemorySheets(emptySeed())
    const store = new Store(api, () => 'T')
    await store.load()
    await store.createActivities([input({ name: '=HYPERLINK("x")', code: '0123' })])
    const row = api.sheets.get('Aktivity')![1]
    expect(row[0]).toBe('=HYPERLINK("x")')
    expect(row[10]).toBe('0123')
  })
})

describe('writing like the real spreadsheet needs', () => {
  it('reads dates that the sheet shows as day counts', async () => {
    const api = new MemorySheets(emptySeed())
    api.sheets.get('Aktivity')!.push(['Bez formátu', '46330', '46337', 'RS CZ', 'SMS', 'Tereza Kucková', 'Schváleno'])
    const data = await new Store(api, () => 'T').load()
    expect(data.activities[0]).toMatchObject({ from: '2026-11-04', to: '2026-11-11' })
    expect(data.warnings).toEqual([])
  })

  it('never inserts rows: new activities go to the first free row and the sheet keeps its size', async () => {
    const api = new MemorySheets(emptySeed())
    api.sheets.get('Aktivity')!.push(['Ručně, bez ID', '5. 12. 2026', '', 'KS CZ', 'Newsletter', 'Tereza Kucková', 'Nápad'])
    api.sheets.get('Aktivity')!.push(['', '', '', '', '', '', ''], ['Druhá ručně', '6. 12. 2026', '', 'KS CZ', 'Newsletter', 'Tereza Kucková', 'Nápad'], ['', '', '', '', '', '', ''])
    const store = new Store(api, () => 'T')
    await store.load()
    const [id] = await store.createActivities([input({ name: 'Nová' })])
    const grid = api.sheets.get('Aktivity')!
    expect(grid[1][0]).toBe('Ručně, bez ID')
    expect(grid[2][0]).toBe('')
    expect(grid[3][0]).toBe('Druhá ručně')
    expect(grid[4][0]).toBe('Nová')
    expect(grid[4][18]).toBe(id)
    const data = await store.load()
    expect(data.activities.map((a) => a.name)).toEqual(['Ručně, bez ID', 'Druhá ručně', 'Nová'])
  })

  it('repeats the write when somebody else wrote into the same row at the same moment', async () => {
    const api = new MemorySheets(emptySeed())
    let clobbered = false
    const rival: SheetsApi = {
      getValues: (range) => api.getValues(range),
      async updateValues(range, values) {
        await api.updateValues(range, values)
        if (!clobbered && /^'Aktivity'!A2:/.test(range)) {
          clobbered = true
          // the other person's write lands on the same row right after ours
          await api.updateValues("'Aktivity'!A2:W2", [['Cizí aktivita', '1. 12. 2026', null, 'RS CZ', 'SMS', 'X', 'Nápad', null, null, null, null, null, null, null, null, null, null, null, 'A-CIZI']])
        }
      },
    }
    const store = new Store(rival, () => 'T')
    await store.load()
    const [id] = await store.createActivities([input({ name: 'Moje' })])
    const grid = api.sheets.get('Aktivity')!
    expect(grid[1][18]).toBe('A-CIZI')
    expect(grid[2][0]).toBe('Moje')
    expect(grid[2][18]).toBe(id)
  })

  it('says so when the write cannot be confirmed three times in a row', async () => {
    const api = new MemorySheets(emptySeed())
    const broken: SheetsApi = { getValues: (r) => api.getValues(r), updateValues: async () => undefined }
    const store = new Store(broken, () => 'T')
    await store.load()
    await expect(store.createActivities([input()])).rejects.toThrow('zapisoval ještě někdo další')
  })
})

describe('connector answers', () => {
  it('finds the grid in the envelopes the connector uses', () => {
    expect(findValues({ range: 'A1:B2', values: [['a', 1], [null, 'b']] })).toEqual([['a', '1'], ['', 'b']])
    expect(findValues({ range: 'A1:B2' })).toEqual([])
    expect(findValues({ content: { range: 'x', values: [['a']] } })).toEqual([['a']])
    expect(findValues('{"range":"x","values":[["a"]]}')).toEqual([['a']])
    expect(findValues([{ type: 'text', text: '{"range":"x","values":[["a"]]}' }])).toEqual([['a']])
    expect(findValues({ error: 'nope' })).toBeNull()
  })
})
