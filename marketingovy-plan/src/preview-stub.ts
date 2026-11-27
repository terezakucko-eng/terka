/**
 * Stands in for the Claude page runtime when the page is opened outside Claude, so the real code path
 * (connector calls, name of the viewer, file saving) can be driven in a browser. Never part of the published page.
 */
import { emptySeed, exampleSeed, MemorySheets } from './data/mockApi'

const w = window as unknown as Record<string, unknown>
const params = new URLSearchParams(location.search)
const sheets = new MemorySheets(params.get('seed') === 'empty' ? emptySeed() : exampleSeed(params.get('today') ?? undefined))
w.__sheets = sheets
w.__downloads = [] as { filename: string; data: unknown }[]
w.__calls = [] as string[]

const failWrites = params.get('fail') === 'write'
const readOnlyTools = params.get('tools') === 'read'

const tools = readOnlyTools ? ['get_values'] : ['get_values', 'update_values']

const mcp = {
  async listTools() { return { servers: [{ server: 'Google Sheets', tools: tools.map((name) => ({ name })) }] } },
  async callTool(server: string, tool: string, input: { range: string; values?: unknown[][] }) {
    ;(w.__calls as string[]).push(tool)
    if (server !== 'Google Sheets') throw { code: 'server_not_connected', message: 'x' }
    if (tool === 'get_values') {
      const values = await sheets.getValues(input.range)
      return { payload: values.length ? { range: input.range, values } : { range: input.range } }
    }
    if (failWrites) throw { code: 'server_unavailable', message: 'x', retryable: true }
    if (tool === 'update_values') { await sheets.updateValues(input.range, input.values as never); return { payload: { updatedCells: 1 } } }
    throw { code: 'not_in_manifest', message: 'x' }
  },
}

w.claude = {
  async use(name: string) {
    if (name === 'mcp') return mcp
    if (name === 'user') return { async name() { return 'Tereza Kucková' } }
    if (name === 'downloads') return { async save(r: { filename: string; data: unknown }) { (w.__downloads as unknown[]).push(r) } }
    return null
  },
}
