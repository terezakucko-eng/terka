import React from 'react'
import { createRoot } from 'react-dom/client'
import { canWrite, mcpSheets, type McpLike } from './data/mcpApi'
import { exampleSeed, MemorySheets } from './data/mockApi'
import { App } from './ui/App'

/** The spreadsheet that holds the data. It is not a secret; who may open it is decided by Google. */
export const SPREADSHEET_ID = '1wnEzJbKOFz5nLWcSOXj__g9cP_xTTpVdiOCpMQAK_UU'

interface ClaudeRuntime { use(name: string): Promise<unknown | null> }
interface UserApi { name?: () => Promise<string> }
interface DownloadsApi { save(request: { filename: string; data: string | Blob }): Promise<unknown> }

async function boot() {
  const mount = document.getElementById('app')
  if (!mount) return
  const root = createRoot(mount)
  root.render(<p className="muted" role="status" style={{ padding: 24 }}>Načítám…</p>)

  const claude = (window as unknown as { claude?: ClaudeRuntime }).claude
  const [mcp, user, downloads] = claude
    ? await Promise.all([claude.use('mcp'), claude.use('user'), claude.use('downloads')]) as [McpLike | null, UserApi | null, DownloadsApi | null]
    : [null, null, null]
  const who = (await user?.name?.().catch(() => ''))?.trim() ?? ''
  const saveFile = downloads ? async (filename: string, content: string) => { await downloads.save({ filename, data: content }) } : undefined

  if (mcp) {
    const writable = await canWrite(mcp)
    root.render(<App api={mcpSheets(mcp, SPREADSHEET_ID)} who={who} demo={false} readOnly={!writable} saveFile={saveFile} />)
  } else {
    root.render(<App api={new MemorySheets(exampleSeed())} who={who || 'Tereza Kucková'} demo saveFile={saveFile} />)
  }
}

void boot()
