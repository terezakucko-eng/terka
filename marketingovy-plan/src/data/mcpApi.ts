import { type Cell } from '../lib/parse'
import { SheetError, type SheetsApi } from './sheets'

/** The connector's display name in Claude and the three of its tools this page is allowed to call. */
export const SERVER = 'Google Sheets'
export const TOOL = { get: 'get_values', update: 'update_values' } as const

interface McpErrorLike {
  code?: string
  message?: string
  retryable?: boolean
  retryAfterMs?: number
}

interface ToolResult {
  payload?: unknown
  structuredContent?: unknown
  content?: unknown
}

export interface McpLike {
  callTool(server: string, tool: string, input?: unknown, options?: unknown): Promise<ToolResult>
  listTools?(server?: string): Promise<{ servers: { server: string; tools: { name: string }[] }[] }>
}

const CONNECTORS = 'v Claude v Nastavení → Konektory (Settings → Connectors)'

const MESSAGES: Record<string, string> = {
  needs_reauth: `Propojení s Google Tabulkami vypršelo. Obnov ho ${CONNECTORS} a načti data znovu.`,
  server_not_connected: `V Claude nemáš připojené Google Tabulky. Přidej je ${CONNECTORS} a načti data znovu.`,
  selection_required: 'Máš v Claude víc propojení s Google Tabulkami. Vyber jedno ve výzvě, kterou Claude zobrazí, a načti data znovu.',
  not_in_manifest: 'Tahle stránka nemá povolený přístup ke Google Tabulkám. Povol ho v nabídce Oprávnění u této stránky a načti data znovu.',
  consent_required: 'Přístup ke Google Tabulkám jsi zatím nepovolila. Zkus to znovu a ve výzvě ho povol.',
  blocked_by_policy: 'Vaše organizace tenhle nástroj Google Tabulek stránkám v Claude nepovoluje. Obrať se na správce účtu Claude.',
  approval_required: 'Claude čeká na potvrzení téhle akce. Zkus ji znovu a ve výzvě ji povol.',
  server_unavailable: 'Google Tabulky teď neodpovídají. Zkus to za chvíli znovu.',
  rate_limited: 'Je toho moc najednou. Počkej pár vteřin a zkus to znovu.',
  not_granted: 'V tomhle zobrazení není propojení s Google Tabulkami k dispozici. Otevři stránku přímo v Claude.',
  capability_disabled: 'V tomhle zobrazení není propojení s Google Tabulkami k dispozici. Otevři stránku přímo v Claude.',
  capability_removed: 'V tomhle zobrazení není propojení s Google Tabulkami k dispozici. Otevři stránku přímo v Claude.',
  cancelled: 'Akce byla zrušena.',
  user_changed: 'V Claude je teď přihlášený někdo jiný. Načti stránku znovu.',
}

function toSheetError(e: unknown, writing: boolean): SheetError {
  const err = (e ?? {}) as McpErrorLike
  const code = typeof err.code === 'string' ? err.code : 'upstream_error'
  if (code === 'tool_error') {
    const detail = String(err.message ?? '').slice(0, 300)
    if (/grid limits|exceeds|out of range|beyond/i.test(detail)) return new SheetError('sheet_full', 'List v tabulce je zaplněný až do posledního řádku. V tabulce přidej další řádky (Vložit → Řádky níže) a akci zopakuj.')
    const access = /permission|forbidden|403|not found|404|access/i.test(detail)
    return new SheetError(code, access
      ? 'K tabulce „Marketingový plán – data“ nemáš přístup, nebo byla přesunuta do koše. Požádej o sdílení s právem úprav.'
      : `Google Tabulky akci odmítly${detail ? `: ${detail}` : '.'}`)
  }
  if (MESSAGES[code]) return new SheetError(code, MESSAGES[code], !writing && err.retryable === true)
  return new SheetError(code, writing
    ? 'Zápis se nepodařilo potvrdit. Načti data znovu a zkontroluj, jestli se změna uložila, než ji zopakuješ.'
    : 'Nepodařilo se spojit s Google Tabulkami. Zkus to znovu.', !writing && err.retryable === true)
}

/** Finds the grid in whatever envelope the connector answers with; an empty range has no `values` at all. */
export function findValues(payload: unknown, depth = 0): string[][] | null {
  if (depth > 4 || payload == null) return null
  if (typeof payload === 'string') {
    try { return findValues(JSON.parse(payload), depth + 1) } catch { return null }
  }
  if (Array.isArray(payload)) {
    if (payload.every((r) => Array.isArray(r))) return payload.map((r) => (r as unknown[]).map((c) => (c == null ? '' : String(c))))
    for (const item of payload) {
      const found = findValues((item as { text?: unknown })?.text ?? item, depth + 1)
      if (found) return found
    }
    return null
  }
  if (typeof payload === 'object') {
    const o = payload as Record<string, unknown>
    if (Array.isArray(o.values)) return findValues(o.values, depth + 1) ?? []
    for (const key of ['content', 'valueRange', 'result', 'data', 'structuredContent']) {
      if (o[key] != null) {
        const found = findValues(o[key], depth + 1)
        if (found) return found
      }
    }
    if (typeof o.range === 'string') return []
  }
  return null
}

const wait = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

/** Spreadsheet access through the viewer's own Google Sheets connector in Claude. */
export function mcpSheets(mcp: McpLike, spreadsheetId: string): SheetsApi {
  async function read(range: string, attempt = 0): Promise<string[][]> {
    let result: ToolResult
    try {
      result = await mcp.callTool(SERVER, TOOL.get, { spreadsheetId, range }, { cache: false })
    } catch (e) {
      const err = toSheetError(e, false)
      if (err.retryable && attempt === 0) {
        await wait(Math.min((e as McpErrorLike).retryAfterMs ?? 1200, 15000) + Math.random() * 600)
        return read(range, 1)
      }
      throw err
    }
    const values = findValues(result.payload ?? result.structuredContent ?? result.content)
    if (!values) throw new SheetError('bad_payload', 'Google Tabulky odpověděly ve tvaru, kterému stránka nerozumí. Dej vědět tomu, kdo ji spravuje.')
    return values
  }
  async function write(tool: string, range: string, values: Cell[][]): Promise<void> {
    try {
      await mcp.callTool(SERVER, tool, { spreadsheetId, range, values }, { cache: false })
    } catch (e) {
      throw toSheetError(e, true)
    }
  }
  return {
    getValues: (range) => read(range),
    updateValues: (range, values) => write(TOOL.update, range, values),
  }
}

/** Whether the viewer's connector offers the writing tool; unknown counts as yes and the first write decides. */
export async function canWrite(mcp: McpLike): Promise<boolean> {
  try {
    const listed = await mcp.listTools?.(SERVER)
    const tools = listed?.servers.find((s) => s.server === SERVER)?.tools.map((t) => t.name) ?? []
    if (!tools.length) return true
    return tools.includes(TOOL.update)
  } catch {
    return true
  }
}
