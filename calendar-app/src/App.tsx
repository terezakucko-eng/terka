import { useState, useEffect, useCallback } from 'react'
import { RefreshCw, ExternalLink, CheckCircle2, Circle, ChevronDown, ChevronRight, AlertCircle, Clock, Calendar, Inbox, Bell, Plus, Trash2, CheckSquare, Square, Link } from 'lucide-react'

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

function formatDateTime(dateStr) {
  if (!dateStr || dateStr === '0001-01-01T00:00:00Z') return null
  const d = new Date(dateStr)
  return d.toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
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

const NOTIF_LABELS = {
  Mention: '@ zmínka', Comment: 'Komentář', Todo: 'Úkol',
  Message: 'Zpráva', ScheduleEntry: 'Událost', Document: 'Dokument', Upload: 'Soubor',
}

// ── Soukromé úkoly ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'terka_private_todos'
function loadPrivate() {
  try { return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]') } catch { return [] }
}
function savePrivate(items) { localStorage.setItem(STORAGE_KEY, JSON.stringify(items)) }

function PrivateTodosTab() {
  const [items, setItems] = useState(loadPrivate)
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [link, setLink] = useState('')
  const [showDone, setShowDone] = useState(false)

  const persist = (next) => { setItems(next); savePrivate(next) }
  const add = () => {
    const text = title.trim()
    if (!text) return
    const url = link.trim()
    persist([{
      id: Date.now(),
      text,
      due: due || null,
      link: url ? (url.startsWith('http') ? url : 'https://' + url) : null,
      done: false,
    }, ...items])
    setTitle(''); setDue(''); setLink('')
  }
  const toggle = (id) => persist(items.map(i => i.id === id ? { ...i, done: !i.done } : i))
  const remove = (id) => persist(items.filter(i => i.id !== id))

  const open = items.filter(i => !i.done)
  const done = items.filter(i => i.done)

  const ItemRow = ({ item, faded = false }) => (
    <div className={`flex items-start gap-3 px-4 py-3 group hover:bg-gray-50 ${faded ? 'opacity-60' : ''}`}>
      <button onClick={() => toggle(item.id)} className={`mt-0.5 flex-shrink-0 ${faded ? 'text-indigo-400 hover:text-indigo-600' : 'text-gray-300 hover:text-indigo-500'}`}>
        {faded ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
      </button>
      <div className="flex-1 min-w-0">
        <p className={`text-sm ${faded ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{item.text}</p>
        <div className="flex items-center gap-3 mt-0.5 flex-wrap">
          {item.due && (
            <span className="text-xs text-gray-400 flex items-center gap-1">
              <Calendar className="w-3 h-3" />
              {new Date(item.due + 'T00:00:00').toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}
            </span>
          )}
          {item.link && (
            <a href={item.link} target="_blank" rel="noreferrer"
              className="text-xs text-indigo-500 hover:text-indigo-700 flex items-center gap-1 truncate max-w-xs">
              <Link className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{item.link.replace(/^https?:\/\//, '')}</span>
            </a>
          )}
        </div>
      </div>
      <button onClick={() => remove(item.id)} className="opacity-0 group-hover:opacity-100 text-gray-300 hover:text-red-500 flex-shrink-0 mt-0.5">
        <Trash2 className="w-3.5 h-3.5" />
      </button>
    </div>
  )

  return (
    <div>
      {/* Formulář */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 mb-5">
        <div className="flex gap-2 mb-3">
          <input
            type="text" value={title}
            onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()}
            placeholder="Název úkolu…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          <button onClick={add} disabled={!title.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 text-sm font-medium">
            <Plus className="w-4 h-4" /> Přidat
          </button>
        </div>
        <div className="flex gap-2">
          <div className="flex items-center gap-1.5 flex-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="date" value={due}
              onChange={e => setDue(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <Link className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input
              type="url" value={link}
              onChange={e => setLink(e.target.value)}
              placeholder="https://…"
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
        </div>
      </div>

      {open.length === 0 && done.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Žádné soukromé úkoly</p>
          <p className="text-xs mt-1">Uloženo pouze ve tvém prohlížeči</p>
        </div>
      )}

      {open.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden mb-4">
          <div className="bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">Otevřené · {open.length}</div>
          <div className="bg-white divide-y divide-gray-100">
            {open.map(item => <ItemRow key={item.id} item={item} />)}
          </div>
        </div>
      )}

      {done.length > 0 && (
        <div className="rounded-xl border border-gray-200 overflow-hidden">
          <button onClick={() => setShowDone(v => !v)}
            className="w-full bg-gray-50 px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wide text-left flex items-center justify-between">
            <span>Dokončené · {done.length}</span>
            {showDone ? <ChevronDown className="w-4 h-4" /> : <ChevronRight className="w-4 h-4" />}
          </button>
          {showDone && (
            <div className="bg-white divide-y divide-gray-100">
              {done.map(item => <ItemRow key={item.id} item={item} faded />)}
            </div>
          )}
        </div>
      )}
      <p className="text-xs text-gray-400 mt-4 text-center">Uloženo lokálně v prohlížeči · nikdo jiný to nevidí</p>
    </div>
  )
}

// ── Notifikace ──────────────────────────────────────────────────────────────
function NotificationsTab() {
  const [unreads, setUnreads] = useState([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      const { data } = await apiFetch('/my/readings.json')
      setUnreads(data?.unreads || [])
      setLastSync(new Date())
    } catch (e) { setError('Chyba: ' + e.message) }
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return (
    <div className="text-center py-20 text-gray-400">
      <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin opacity-40" /><p>Načítám notifikace…</p>
    </div>
  )

  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {unreads.length > 0
            ? <span className="font-semibold text-orange-600">{unreads.length} nepřečtených</span>
            : 'Vše přečteno'}
          {lastSync && <span className="ml-2 text-gray-400">· {lastSync.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}</span>}
        </p>
        <button onClick={load}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg hover:border-indigo-300">
          <RefreshCw className="w-3.5 h-3.5" /> Obnovit
        </button>
      </div>

      {unreads.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bell className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Žádné nepřečtené notifikace</p>
        </div>
      ) : (
        <div className="rounded-xl border border-orange-200 overflow-hidden">
          <div className="bg-orange-50 px-4 py-2.5 text-xs font-semibold text-orange-600 uppercase tracking-wide">Nepřečtené · {unreads.length}</div>
          <div className="bg-white divide-y divide-gray-100">
            {unreads.map((n, i) => (
              <a key={n.id || i} href={n.app_url} target="_blank" rel="noreferrer"
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 group">
                <Bell className="w-4 h-4 mt-0.5 text-orange-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium truncate">{n.title}</p>
                  {n.content_excerpt && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.content_excerpt}</p>}
                  <p className="text-xs text-gray-400 mt-1">
                    <span className="font-medium text-gray-500">{n.bucket_name}</span>
                    {n.type && <><span className="mx-1">·</span>{NOTIF_LABELS[n.type] || n.type}</>}
                    {formatDateTime(n.unread_at) && <><span className="mx-1">·</span>{formatDateTime(n.unread_at)}</>}
                  </p>
                </div>
                <ExternalLink className="w-3.5 h-3.5 opacity-0 group-hover:opacity-100 text-gray-400 flex-shrink-0 mt-0.5" />
              </a>
            ))}
          </div>
        </div>
      )}

    </div>
  )
}

// ── Hlavní app ──────────────────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState('todos')
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [filterProject, setFilterProject] = useState('all')

  const load = useCallback(async () => {
    setLoading(true); setError(null)
    try {
      setLoadingMsg('Načítám projekty…')
      const projects = await fetchAll('/projects.json')
      setLoadingMsg(`Načítám úkoly z ${projects.length} projektů…`)

      const todosetJobs = projects.flatMap(proj =>
        (proj.dock || [])
          .filter(d => d.name === 'todoset' && d.enabled)
          .map(d => ({ proj, path: d.url.replace(/^https:\/\/3\.basecampapi\.com\/\d+/, '') }))
      )

      const todosetResults = await Promise.allSettled(todosetJobs.map(({ path }) => apiFetch(path)))

      const listJobs = todosetResults.flatMap((res, i) => {
        if (res.status !== 'fulfilled') return []
        const tlPath = res.value.data.todolists_url.replace(/^https:\/\/3\.basecampapi\.com\/\d+/, '')
        return [{ proj: todosetJobs[i].proj, path: tlPath }]
      })

      const listResults = await Promise.allSettled(listJobs.map(({ path }) => fetchAll(path)))

      const todoJobs = listResults.flatMap((res, i) => {
        if (res.status !== 'fulfilled') return []
        return res.value.map(list => ({ proj: listJobs[i].proj, list }))
      })

      const todoResults = await Promise.allSettled(todoJobs.map(({ list }) => fetchTodosFromList(list)))

      const results = []
      todoResults.forEach((res, i) => {
        if (res.status !== 'fulfilled') return
        const { proj, list } = todoJobs[i]
        for (const t of res.value) {
          const isAssigned = (t.assignees || []).some(a => a.id === TEREZA_ID)
          const isCreator = t.creator?.id === TEREZA_ID
          if (isAssigned || isCreator) {
            results.push({
              id: t.id, content: t.content, completed: t.completed,
              due: t.due_on || null, project: proj.name, list: list.name,
              url: t.app_url, section: getSection(t.due_on),
            })
          }
        }
      })

      results.sort((a, b) => {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1; if (!b.due) return -1
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

  const TABS = [
    { key: 'todos', label: 'Moje úkoly' },
    { key: 'notifications', label: 'Notifikace' },
    { key: 'private', label: 'Soukromé úkoly' },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Můj dashboard · Basecamp</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Tereza Kucková ·{' '}
            {tab === 'todos' && (lastSync ? `aktualizováno ${lastSync.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : 'načítám…')}
            {tab === 'notifications' && 'notifikace'}
            {tab === 'private' && 'soukromé úkoly'}
          </p>
        </div>
        {tab === 'todos' && (
          <button onClick={load} disabled={loading}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            {loading ? 'Načítám…' : 'Aktualizovat'}
          </button>
        )}
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex gap-1">
          {TABS.map(t => (
            <button key={t.key} onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-3xl mx-auto px-4 py-6">
        {tab === 'todos' && (
          <>
            {error && (
              <div className="mb-4 p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
                <strong>Chyba:</strong> {error}
                {error.includes('proxy') && <code className="block mt-2 bg-red-100 rounded p-2 font-mono text-xs">node basecamp-proxy.js</code>}
              </div>
            )}

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

            {projects.length > 1 && (
              <div className="mb-4 flex items-center gap-2 flex-wrap">
                <button onClick={() => setFilterProject('all')}
                  className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterProject === 'all' ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'}`}>
                  Vše
                </button>
                {projects.map(p => (
                  <button key={p} onClick={() => setFilterProject(p)}
                    className={`px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${filterProject === p ? 'bg-indigo-600 text-white' : 'bg-white text-gray-600 border border-gray-200 hover:border-indigo-300'}`}>
                    {p}
                  </button>
                ))}
              </div>
            )}

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
                    <button onClick={() => toggle(sec.key)}
                      className={`w-full flex items-center gap-3 px-4 py-3 ${sec.bg} text-left`}>
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
                                {todo.project}
                                <span className="mx-1">·</span>{todo.list}
                                {todo.due && <><span className="mx-1">·</span>{formatDate(todo.due)}</>}
                              </p>
                            </div>
                            <a href={todo.url} target="_blank" rel="noreferrer"
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-600 text-gray-400 flex-shrink-0" title="Otevřít v Basecamp">
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
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-40" /><p>Žádné otevřené úkoly</p>
              </div>
            )}
          </>
        )}

        {tab === 'notifications' && <NotificationsTab />}
        {tab === 'private' && <PrivateTodosTab />}
      </div>
    </div>
  )
}
