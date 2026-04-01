import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ExternalLink, CheckCircle2, Circle, ChevronDown, ChevronRight, AlertCircle, Clock, Calendar, Inbox } from 'lucide-react'

const IS_LOCAL = typeof window !== 'undefined' && window.location.hostname === 'localhost'
const TEREZA_ID = 43838310

async function apiFetch(path) {
  const url = IS_LOCAL
    ? `http://localhost:3001/api${path}`
    : `/.netlify/functions/basecamp?path=${encodeURIComponent(path)}`
  const res = await fetch(url)
  if (!res.ok) {
    const body = await res.text().catch(() => '')
    throw new Error(body || `${res.status}`)
  }
  const data = await res.json()
  const link = res.headers.get('Link') || ''
  const next = link.match(/<https:\/\/3\.basecampapi\.com\/\d+([^>]*)>;\s*rel="next"/)
  return { data, next: next ? next[1] : null }
}

async function fetchAll(path) {
  const items = []
  let url = path
  while (url) {
    const { data, next } = await apiFetch(url)
    items.push(...(Array.isArray(data) ? data : []))
    url = next
  }
  return items
}

// Vrátí todos ze seznamu + ze všech skupin uvnitř seznamu
async function fetchTodosFromList(list) {
  const todosPath = list.todos_url.replace(/^https:\/\/3\.basecampapi\.com\/\d+/, '')
  const groupsPath = list.groups_url
    ? list.groups_url.replace(/^https:\/\/3\.basecampapi\.com\/\d+/, '')
    : todosPath.replace('/todos.json', '/groups.json')

  const [directTodos, groups] = await Promise.all([
    fetchAll(todosPath).catch(() => []),
    fetchAll(groupsPath).catch(() => []),
  ])

  const groupTodos = await Promise.all(
    groups.map(g => fetchAll(g.todos_url.replace(/^https:\/\/3\.basecampapi\.com\/\d+/, '')).catch(() => []))
  )

  return [...directTodos, ...groupTodos.flat()]
}

function formatDate(dateStr) {
  if (!dateStr) return null
  const d = new Date(dateStr + 'T00:00:00')
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })
}

function getSection(due) {
  if (!due) return 'later'
  const today = new Date().toISOString().split('T')[0]
  const tomorrow = new Date(Date.now() + 86400000).toISOString().split('T')[0]
  const weekEnd = new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0]
  if (due < today) return 'overdue'
  if (due === today) return 'today'
  if (due === tomorrow) return 'tomorrow'
  if (due <= weekEnd) return 'week'
  return 'later'
}

const SECTIONS = [
  { key: 'overdue', label: 'Po termínu', icon: AlertCircle, color: 'text-red-600', bg: 'bg-red-50', border: 'border-red-200' },
  { key: 'today',   label: 'Dnes',       icon: Clock,        color: 'text-orange-600', bg: 'bg-orange-50', border: 'border-orange-200' },
  { key: 'tomorrow',label: 'Zítra',      icon: Calendar,     color: 'text-yellow-600', bg: 'bg-yellow-50', border: 'border-yellow-200' },
  { key: 'week',    label: 'Tento týden',icon: Calendar,     color: 'text-blue-600',   bg: 'bg-blue-50',   border: 'border-blue-200' },
  { key: 'later',   label: 'Později / bez termínu', icon: Inbox, color: 'text-gray-500', bg: 'bg-gray-50', border: 'border-gray-200' },
]

export default function App() {
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [filterProject, setFilterProject] = useState('all')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      setLoadingMsg('Načítám projekty…')
      const projects = await fetchAll('/projects.json')
      setLoadingMsg(`Načítám úkoly z ${projects.length} projektů…`)

      // Paralelně načti todosets pro všechny projekty
      const todosetJobs = projects.flatMap(proj =>
        (proj.dock || [])
          .filter(d => d.name === 'todoset' && d.enabled)
          .map(d => ({ proj, path: d.url.replace(/^https:\/\/3\.basecampapi\.com\/\d+/, '') }))
      )

      const todosetResults = await Promise.allSettled(
        todosetJobs.map(({ path }) => apiFetch(path))
      )

      // Paralelně načti všechny todolists
      const listJobs = todosetResults.flatMap((res, i) => {
        if (res.status !== 'fulfilled') return []
        const tlPath = res.value.data.todolists_url.replace(/^https:\/\/3\.basecampapi\.com\/\d+/, '')
        return [{ proj: todosetJobs[i].proj, path: tlPath }]
      })

      const listResults = await Promise.allSettled(
        listJobs.map(({ path }) => fetchAll(path))
      )

      // Paralelně načti todos ze všech listů (včetně skupin uvnitř listů)
      const todoJobs = listResults.flatMap((res, i) => {
        if (res.status !== 'fulfilled') return []
        return res.value.map(list => ({
          proj: listJobs[i].proj,
          list,
        }))
      })

      const todoResults = await Promise.allSettled(
        todoJobs.map(({ list }) => fetchTodosFromList(list))
      )

      const results = []
      todoResults.forEach((res, i) => {
        if (res.status !== 'fulfilled') return
        const { proj, list } = todoJobs[i]
        for (const t of res.value) {
          const isAssigned = (t.assignees || []).some(a => a.id === TEREZA_ID)
          const isCreator = t.creator?.id === TEREZA_ID
          if (isAssigned || isCreator) {
            results.push({
              id: t.id,
              content: t.content,
              completed: t.completed,
              due: t.due_on || null,
              project: proj.name,
              list: list.name,
              url: t.app_url,
              section: getSection(t.due_on),
            })
          }
        }
      })

      results.sort((a, b) => {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return a.due.localeCompare(b.due)
      })
      setTodos(results)
      setLastSync(new Date())
    } catch (e) {
      setError(e.message.includes('Failed to fetch')
        ? 'Nelze se připojit. Spusť: node basecamp-proxy.js'
        : 'Chyba načítání: ' + e.message)
    }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  const open = todos.filter(t => !t.completed)
  const projects = [...new Set(open.map(t => t.project))].sort()
  const visible = filterProject === 'all' ? open : open.filter(t => t.project === filterProject)

  const grouped = {}
  for (const s of SECTIONS) grouped[s.key] = visible.filter(t => t.section === s.key)

  const toggle = key => setCollapsed(c => ({ ...c, [key]: !c[key] }))

  return (
    <div className="min-h-screen bg-gray-100">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Moje úkoly v Basecamp</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tereza Kucková ·{' '}
            {lastSync
              ? `aktualizováno ${lastSync.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}`
              : 'načítám…'}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium"
        >
          <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          {loading ? 'Načítám…' : 'Aktualizovat'}
        </button>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {error && (
          <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
            <strong>Chyba:</strong> {error}
            {error.includes('proxy') && (
              <code className="block mt-2 bg-red-100 rounded p-2 font-mono text-xs">node basecamp-proxy.js</code>
            )}
          </div>
        )}

        {/* Statistiky */}
        {!loading && todos.length > 0 && (
          <div className="grid grid-cols-4 gap-3 mb-6">
            {[
              { label: 'Celkem', count: open.length, color: 'bg-white' },
              { label: 'Po termínu', count: grouped.overdue?.length, color: 'bg-red-50', text: 'text-red-700' },
              { label: 'Dnes', count: grouped.today?.length, color: 'bg-orange-50', text: 'text-orange-700' },
              { label: 'Tento týden', count: (grouped.tomorrow?.length || 0) + (grouped.week?.length || 0), color: 'bg-blue-50', text: 'text-blue-700' },
            ].map(s => (
              <div key={s.label} className={`${s.color} rounded-xl p-3 border border-gray-200 text-center`}>
                <div className={`text-2xl font-bold ${s.text || 'text-gray-800'}`}>{s.count}</div>
                <div className="text-xs text-gray-500 mt-0.5">{s.label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filtr projektu */}
        {projects.length > 1 && (
          <div className="mb-4 flex items-center gap-2 flex-wrap">
            <button
              onClick={() => setFilterProject('all')}
              className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterProject === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'}`}
            >
              Vše
            </button>
            {projects.map(p => (
              <button
                key={p}
                onClick={() => setFilterProject(p)}
                className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterProject === p ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'}`}
              >
                {p.replace(/^\[.*?\]\s*/, '')}
              </button>
            ))}
          </div>
        )}

        {/* Sekce */}
        {loading && todos.length === 0 ? (
          <div className="text-center py-20 text-gray-400">
            <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin opacity-40" />
            <p>{loadingMsg || 'Načítám…'}</p>
          </div>
        ) : (
          SECTIONS.map(sec => {
            const items = grouped[sec.key] || []
            if (items.length === 0) return null
            const Icon = sec.icon
            const isOpen = !collapsed[sec.key]
            return (
              <div key={sec.key} className={`mb-4 rounded-xl border ${sec.border} overflow-hidden`}>
                <button
                  onClick={() => toggle(sec.key)}
                  className={`w-full flex items-center gap-3 px-4 py-3 ${sec.bg} text-left`}
                >
                  <Icon className={`w-4 h-4 ${sec.color} flex-shrink-0`} />
                  <span className={`font-semibold text-sm ${sec.color}`}>{sec.label}</span>
                  <span className={`ml-auto text-sm font-bold ${sec.color}`}>{items.length}</span>
                  {isOpen ? <ChevronDown className={`w-4 h-4 ${sec.color}`} /> : <ChevronRight className={`w-4 h-4 ${sec.color}`} />}
                </button>

                {isOpen && (
                  <div className="bg-white divide-y divide-gray-100">
                    {items.map(todo => (
                      <div key={todo.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 group">
                        <Circle className="w-4 h-4 mt-0.5 text-gray-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-800 leading-snug">{todo.content}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {todo.project.replace(/^\[.*?\]\s*/, '')}
                            <span className="mx-1">·</span>
                            {todo.list}
                            {todo.due && <><span className="mx-1">·</span>{formatDate(todo.due)}</>}
                          </p>
                        </div>
                        <a
                          href={todo.url}
                          target="_blank"
                          rel="noreferrer"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-600 text-gray-400 flex-shrink-0"
                          title="Otevřít v Basecamp"
                        >
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )
          })
        )}

        {!loading && visible.length === 0 && todos.length > 0 && (
          <div className="text-center py-16 text-gray-400">
            <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-40" />
            <p>Žádné otevřené úkoly</p>
          </div>
        )}
      </div>
    </div>
  )
}
