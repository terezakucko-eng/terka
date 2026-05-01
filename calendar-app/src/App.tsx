import { useState, useEffect, useCallback, useRef } from 'react'
import { db } from './firebase'
import { doc, onSnapshot, setDoc } from 'firebase/firestore'
import { RefreshCw, ExternalLink, CheckCircle2, Circle, ChevronDown, ChevronRight, AlertCircle, Clock, Calendar, Inbox, Bell, Plus, Trash2, CheckSquare, Square, Link, Pencil, X, Tag, Repeat2, EyeOff, Eye, FileText, Bookmark } from 'lucide-react'

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

// ── Poznámkový blok – karta poznámky ────────────────────────────────────────
function NoteCard({ note, labels, onSaveContent, onDelete, onToggleLabel }) {
  const editorRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (editorRef.current) {
      editorRef.current.innerHTML = note.content || ''
    }
  }, [note.id])

  const saveContent = () => {
    onSaveContent(note.id, editorRef.current?.innerHTML || '')
  }

  const fmt = (cmd: string) => {
    editorRef.current?.focus()
    document.execCommand(cmd, false, undefined)
  }

  return (
    <div className="bg-white rounded-xl border border-gray-200 p-4 mb-3">
      <div className="flex items-center gap-0.5 mb-2 pb-2 border-b border-gray-100">
        <button onMouseDown={e => { e.preventDefault(); fmt('bold') }}
          className="w-7 h-7 flex items-center justify-center text-sm font-bold text-gray-500 hover:bg-gray-100 rounded" title="Tučně">
          B
        </button>
        <button onMouseDown={e => { e.preventDefault(); fmt('italic') }}
          className="w-7 h-7 flex items-center justify-center text-sm italic text-gray-500 hover:bg-gray-100 rounded" title="Kurzíva">
          I
        </button>
        <button onMouseDown={e => { e.preventDefault(); fmt('insertUnorderedList') }}
          className="w-7 h-7 flex items-center justify-center text-base text-gray-500 hover:bg-gray-100 rounded leading-none" title="Odrážky">
          •
        </button>
        <div className="flex-1" />
        <button onClick={() => onDelete(note.id)} className="text-gray-300 hover:text-red-500 p-1" title="Smazat">
          <Trash2 className="w-3.5 h-3.5" />
        </button>
      </div>
      <div
        ref={editorRef}
        contentEditable
        suppressContentEditableWarning
        onBlur={saveContent}
        className="text-sm text-gray-800 min-h-[80px] focus:outline-none leading-relaxed"
      />
      {labels.length > 0 && (
        <div className="flex items-center gap-1.5 flex-wrap mt-3 pt-2 border-t border-gray-100">
          <Tag className="w-3 h-3 text-gray-300 flex-shrink-0" />
          {labels.map(l => (
            <LabelChip key={l.id} label={l}
              active={(note.labelIds || []).includes(l.id)}
              onClick={() => onToggleLabel(note.id, l.id)}
            />
          ))}
        </div>
      )}
    </div>
  )
}

// ── Soukromé úkoly ──────────────────────────────────────────────────────────
const STORAGE_KEY = 'terka_private_todos'
const FIRESTORE_DOC = doc(db, 'privateTodos', 'tereza')

const LABEL_COLORS = [
  { key: 'red',    bg: 'bg-red-100',    text: 'text-red-700',    dot: 'bg-red-400'    },
  { key: 'orange', bg: 'bg-orange-100', text: 'text-orange-700', dot: 'bg-orange-400' },
  { key: 'yellow', bg: 'bg-yellow-100', text: 'text-yellow-700', dot: 'bg-yellow-400' },
  { key: 'green',  bg: 'bg-green-100',  text: 'text-green-700',  dot: 'bg-green-500'  },
  { key: 'blue',   bg: 'bg-blue-100',   text: 'text-blue-700',   dot: 'bg-blue-400'   },
  { key: 'indigo', bg: 'bg-indigo-100', text: 'text-indigo-700', dot: 'bg-indigo-400' },
  { key: 'purple', bg: 'bg-purple-100', text: 'text-purple-700', dot: 'bg-purple-400' },
  { key: 'pink',   bg: 'bg-pink-100',   text: 'text-pink-700',   dot: 'bg-pink-400'   },
]

function LabelChip({ label, onRemove = null, onClick = null, active = true }) {
  const color = LABEL_COLORS.find(c => c.key === label.color) || LABEL_COLORS[4]
  return (
    <span
      onClick={onClick}
      className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${color.bg} ${color.text} ${onClick ? 'cursor-pointer hover:opacity-80' : ''} ${!active ? 'opacity-40' : ''}`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${color.dot} flex-shrink-0`} />
      {label.name}
      {onRemove && (
        <button onClick={e => { e.stopPropagation(); onRemove() }} className="ml-0.5 hover:opacity-70">
          <X className="w-2.5 h-2.5" />
        </button>
      )}
    </span>
  )
}

function PrivateTodosTab() {
  const [items, setItems] = useState([])
  const [labels, setLabels] = useState([])
  const [notes, setNotes] = useState([])
  const [fsLoading, setFsLoading] = useState(true)
  const [notepadLabel, setNotepadLabel] = useState<number | null>(null)

  // form
  const [title, setTitle] = useState('')
  const [due, setDue] = useState('')
  const [link, setLink] = useState('')
  const [note, setNote] = useState('')
  const [repeat, setRepeat] = useState('')
  const [selectedLabelIds, setSelectedLabelIds] = useState([])
  const [editId, setEditId] = useState(null)

  // label management
  const [showLabelMgr, setShowLabelMgr] = useState(false)
  const [newLabelName, setNewLabelName] = useState('')
  const [newLabelColor, setNewLabelColor] = useState('blue')

  // filter
  const [filterLabelId, setFilterLabelId] = useState(null)
  const [showDone, setShowDone] = useState(false)

  const migratedRef = useRef(false)

  useEffect(() => {
    const unsub = onSnapshot(FIRESTORE_DOC, (snap) => {
      if (snap.exists()) {
        const data = snap.data()
        setItems(data.items || [])
        setLabels(data.labels || [])
        setNotes(data.notes || [])
      } else if (!migratedRef.current) {
        migratedRef.current = true
        try {
          const local = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
          setDoc(FIRESTORE_DOC, { items: local, labels: [], notes: [] })
          if (local.length > 0) localStorage.removeItem(STORAGE_KEY)
        } catch { setDoc(FIRESTORE_DOC, { items: [], labels: [], notes: [] }) }
      }
      setFsLoading(false)
    }, () => setFsLoading(false))
    return () => unsub()
  }, [])

  const save = (newItems, newLabels) => {
    setItems(newItems); setLabels(newLabels)
    setDoc(FIRESTORE_DOC, { items: newItems, labels: newLabels, notes })
  }

  const saveNotes = (newNotes) => {
    setNotes(newNotes)
    setDoc(FIRESTORE_DOC, { items, labels, notes: newNotes })
  }

  const addNote = () => {
    saveNotes([{ id: Date.now(), content: '', labelIds: [], createdAt: new Date().toISOString() }, ...notes])
  }

  const clearForm = () => { setTitle(''); setDue(''); setLink(''); setNote(''); setRepeat(''); setSelectedLabelIds([]); setEditId(null) }

  const add = () => {
    const text = title.trim()
    if (!text) return
    const url = link.trim()
    const normalized = url ? (url.startsWith('http') ? url : 'https://' + url) : null
    if (editId !== null) {
      save(items.map(i => i.id === editId ? { ...i, text, due: due || null, link: normalized, note: note.trim() || null, repeat: repeat || null, labelIds: selectedLabelIds } : i), labels)
    } else {
      save([{ id: Date.now(), text, due: due || null, link: normalized, note: note.trim() || null, repeat: repeat || null, labelIds: selectedLabelIds, done: false }, ...items], labels)
    }
    clearForm()
  }

  const startEdit = (item) => {
    setEditId(item.id); setTitle(item.text); setDue(item.due || '')
    setLink(item.link || ''); setNote(item.note || ''); setRepeat(item.repeat || '')
    setSelectedLabelIds(item.labelIds || [])
    window.scrollTo({ top: 0, behavior: 'smooth' })
  }

  const toggle = (id) => {
    save(items.map(i => {
      if (i.id !== id) return i
      const markingDone = !i.done
      if (markingDone && i.repeat) {
        const base = i.due ? new Date(i.due + 'T00:00:00') : new Date()
        if (i.repeat === 'daily')   base.setDate(base.getDate() + 1)
        if (i.repeat === 'weekly')  base.setDate(base.getDate() + 7)
        if (i.repeat === 'monthly') base.setMonth(base.getMonth() + 1)
        if (i.repeat === 'yearly')  base.setFullYear(base.getFullYear() + 1)
        const nextDue = base.toISOString().split('T')[0]
        return { ...i, done: false, due: nextDue }
      }
      return { ...i, done: markingDone }
    }), labels)
  }
  const remove = (id) => { save(items.filter(i => i.id !== id), labels); if (editId === id) clearForm() }

  const addLabel = () => {
    const name = newLabelName.trim()
    if (!name) return
    save(items, [...labels, { id: Date.now(), name, color: newLabelColor }])
    setNewLabelName('')
  }
  const removeLabel = (id) => {
    save(items.map(i => ({ ...i, labelIds: (i.labelIds || []).filter(l => l !== id) })),
         labels.filter(l => l.id !== id))
    if (filterLabelId === id) setFilterLabelId(null)
  }

  const toggleFormLabel = (id) => setSelectedLabelIds(prev =>
    prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]
  )

  if (fsLoading) return (
    <div className="text-center py-20 text-gray-400">
      <RefreshCw className="w-8 h-8 mx-auto mb-3 animate-spin opacity-40" />
      <p className="text-sm">Načítám z Firestore…</p>
    </div>
  )

  const sortByDue = (a, b) => {
    if (!a.due && !b.due) return 0
    if (!a.due) return 1
    if (!b.due) return -1
    return a.due.localeCompare(b.due)
  }

  const allOpen = items.filter(i => !i.done).sort(sortByDue)
  const allDone = items.filter(i => i.done).sort(sortByDue)
  const open = filterLabelId ? allOpen.filter(i => (i.labelIds || []).includes(filterLabelId)) : allOpen
  const done = filterLabelId ? allDone.filter(i => (i.labelIds || []).includes(filterLabelId)) : allDone
  const filteredNotes = notepadLabel ? notes.filter(n => (n.labelIds || []).includes(notepadLabel)) : notes

  const ItemRow = ({ item, faded = false }) => {
    const itemLabels = labels.filter(l => (item.labelIds || []).includes(l.id))
    return (
      <div className={`flex items-start gap-3 px-4 py-3 group hover:bg-gray-50 ${faded ? 'opacity-60' : ''} ${editId === item.id ? 'bg-indigo-50' : ''}`}>
        <button onClick={() => toggle(item.id)} className={`mt-0.5 flex-shrink-0 ${faded ? 'text-indigo-400 hover:text-indigo-600' : 'text-gray-300 hover:text-indigo-500'}`}>
          {faded ? <CheckSquare className="w-4 h-4" /> : <Square className="w-4 h-4" />}
        </button>
        <div className="flex-1 min-w-0">
          <p className={`text-sm ${faded ? 'text-gray-500 line-through' : 'text-gray-800'}`}>{item.text}</p>
          {item.note && !faded && <p className="text-xs text-gray-500 mt-0.5 whitespace-pre-wrap">{item.note}</p>}
          <div className="flex items-center gap-2 mt-1 flex-wrap">
            {itemLabels.map(l => <LabelChip key={l.id} label={l} />)}
            {item.repeat && (
              <span className="text-xs text-gray-400 flex items-center gap-1">
                <Repeat2 className="w-3 h-3" />
                {{ daily: 'denně', weekly: 'týdně', monthly: 'měsíčně', yearly: 'ročně' }[item.repeat]}
              </span>
            )}
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
        <div className="flex gap-1 opacity-0 group-hover:opacity-100 flex-shrink-0 mt-0.5">
          {!faded && <button onClick={() => startEdit(item)} className="text-gray-300 hover:text-indigo-500 p-0.5"><Pencil className="w-3.5 h-3.5" /></button>}
          <button onClick={() => remove(item.id)} className="text-gray-300 hover:text-red-500 p-0.5"><Trash2 className="w-3.5 h-3.5" /></button>
        </div>
      </div>
    )
  }

  return (
    <div>
      {/* Formulář */}
      <div className={`bg-white rounded-xl border p-4 mb-4 ${editId !== null ? 'border-indigo-300 ring-2 ring-indigo-100' : 'border-gray-200'}`}>
        <div className="flex gap-2 mb-3">
          <input type="text" value={title} onChange={e => setTitle(e.target.value)}
            onKeyDown={e => e.key === 'Enter' && add()} placeholder="Název úkolu…"
            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400 focus:border-transparent"
          />
          <button onClick={add} disabled={!title.trim()}
            className="flex items-center gap-1.5 px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-40 text-sm font-medium">
            {editId !== null ? <><Pencil className="w-4 h-4" /> Uložit</> : <><Plus className="w-4 h-4" /> Přidat</>}
          </button>
          {editId !== null && (
            <button onClick={clearForm} className="px-3 py-2 text-gray-400 hover:text-gray-600 border border-gray-200 rounded-lg">
              <X className="w-4 h-4" />
            </button>
          )}
        </div>
        <textarea value={note} onChange={e => setNote(e.target.value)}
          placeholder="Poznámka… (volitelné)" rows={2}
          className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm text-gray-600 resize-none focus:outline-none focus:ring-2 focus:ring-indigo-400 mb-3"
        />
        <div className="flex gap-2 mb-3">
          <div className="flex items-center gap-1.5 flex-1">
            <Calendar className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <input type="date" value={due} onChange={e => setDue(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
            />
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <Repeat2 className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            <select value={repeat} onChange={e => setRepeat(e.target.value)}
              className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400 bg-white">
              <option value="">Neopakovat</option>
              <option value="daily">Denně</option>
              <option value="weekly">Týdně</option>
              <option value="monthly">Měsíčně</option>
              <option value="yearly">Ročně</option>
            </select>
          </div>
        </div>
        <div className="flex items-center gap-1.5 mb-3">
          <Link className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
          <input type="url" value={link} onChange={e => setLink(e.target.value)} placeholder="https://…"
            className="flex-1 px-3 py-1.5 border border-gray-200 rounded-lg text-sm text-gray-600 focus:outline-none focus:ring-2 focus:ring-indigo-400"
          />
        </div>
        {/* Štítky ve formuláři */}
        {labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap">
            <Tag className="w-3.5 h-3.5 text-gray-400 flex-shrink-0" />
            {labels.map(l => (
              <LabelChip key={l.id} label={l} active={selectedLabelIds.includes(l.id)}
                onClick={() => toggleFormLabel(l.id)}
              />
            ))}
          </div>
        )}
      </div>

      {/* Správa štítků */}
      <div className="mb-4">
        <button onClick={() => setShowLabelMgr(v => !v)}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-indigo-600 mb-2">
          <Tag className="w-3.5 h-3.5" />
          {showLabelMgr ? 'Skrýt správu štítků' : 'Spravovat štítky'}
        </button>
        {showLabelMgr && (
          <div className="bg-white rounded-xl border border-gray-200 p-4">
            <div className="flex gap-2 mb-3">
              <input type="text" value={newLabelName} onChange={e => setNewLabelName(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && addLabel()} placeholder="Název štítku…"
                className="flex-1 px-3 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-400"
              />
              <div className="flex gap-1">
                {LABEL_COLORS.map(c => (
                  <button key={c.key} onClick={() => setNewLabelColor(c.key)}
                    className={`w-5 h-5 rounded-full ${c.dot} ${newLabelColor === c.key ? 'ring-2 ring-offset-1 ring-gray-400' : ''}`}
                  />
                ))}
              </div>
              <button onClick={addLabel} disabled={!newLabelName.trim()}
                className="px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-sm hover:bg-indigo-700 disabled:opacity-40">
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {labels.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {labels.map(l => <LabelChip key={l.id} label={l} onRemove={() => removeLabel(l.id)} />)}
              </div>
            ) : (
              <p className="text-xs text-gray-400">Zatím žádné štítky</p>
            )}
          </div>
        )}
      </div>

      {/* Filtr podle štítku */}
      {labels.length > 0 && (
        <div className="flex items-center gap-2 flex-wrap mb-4">
          <button onClick={() => setFilterLabelId(null)}
            className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${filterLabelId === null ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300'}`}>
            Vše
          </button>
          {labels.map(l => (
            <LabelChip key={l.id} label={l} active={filterLabelId === l.id || filterLabelId === null}
              onClick={() => setFilterLabelId(filterLabelId === l.id ? null : l.id)}
            />
          ))}
        </div>
      )}

      {open.length === 0 && done.length === 0 && (
        <div className="text-center py-16 text-gray-400">
          <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p>Žádné soukromé úkoly</p>
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
      <p className="text-xs text-gray-400 mt-4 text-center">Uloženo v Firestore · synchronizováno mezi zařízeními</p>

      {/* ─── Poznámkový blok ─── */}
      <div className="mt-8">
        <div className="flex items-center gap-2 mb-4">
          <FileText className="w-4 h-4 text-indigo-500" />
          <h2 className="text-sm font-semibold text-gray-700">Poznámkový blok</h2>
          <button onClick={addNote}
            className="ml-auto flex items-center gap-1 px-3 py-1.5 bg-indigo-600 text-white rounded-lg text-xs hover:bg-indigo-700">
            <Plus className="w-3.5 h-3.5" /> Nová poznámka
          </button>
        </div>

        {labels.length > 0 && (
          <div className="flex items-center gap-2 flex-wrap mb-4">
            <button onClick={() => setNotepadLabel(null)}
              className={`px-3 py-1 rounded-full text-xs font-medium transition-colors ${notepadLabel === null ? 'bg-indigo-600 text-white' : 'bg-white text-gray-500 border border-gray-200 hover:border-indigo-300'}`}>
              Vše
            </button>
            {labels.map(l => (
              <LabelChip key={l.id} label={l}
                active={notepadLabel === l.id || notepadLabel === null}
                onClick={() => setNotepadLabel(notepadLabel === l.id ? null : l.id)}
              />
            ))}
          </div>
        )}

        {filteredNotes.map(note => (
          <NoteCard
            key={note.id}
            note={note}
            labels={labels}
            onSaveContent={(id, html) => saveNotes(notes.map(n => n.id === id ? { ...n, content: html } : n))}
            onDelete={(id) => saveNotes(notes.filter(n => n.id !== id))}
            onToggleLabel={(noteId, labelId) => saveNotes(notes.map(n => {
              if (n.id !== noteId) return n
              const ids = n.labelIds || []
              return { ...n, labelIds: ids.includes(labelId) ? ids.filter(x => x !== labelId) : [...ids, labelId] }
            }))}
          />
        ))}

        {filteredNotes.length === 0 && (
          <div className="text-center py-10 text-gray-400">
            <FileText className="w-10 h-10 mx-auto mb-3 opacity-25" />
            <p className="text-sm">Žádné poznámky{notepadLabel ? ' pro vybraný štítek' : ''}</p>
          </div>
        )}
      </div>
    </div>
  )
}

// ── Notifikace ──────────────────────────────────────────────────────────────
const SEEN_NOTIFS_KEY = 'terka_seen_notif_ids'

function NotificationsTab({ unreads, loading, error, lastSync, onRefresh }) {
  if (loading && unreads.length === 0) return (
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
        <button onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg hover:border-indigo-300">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Obnovit
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

// ── Don't Forget ────────────────────────────────────────────────────────────
const RECORDING_LABELS = {
  Todo: 'Úkol', Message: 'Zpráva', Document: 'Dokument',
  Upload: 'Soubor', 'Kanban::Card': 'Karta', 'Schedule::Entry': 'Událost',
  Comment: 'Komentář', 'Question::Answer': 'Check-in',
}

function DontForgetTab({ items, loading, error, onRefresh }) {
  if (loading && items.length === 0) return (
    <div className="text-center py-20 text-gray-400">
      <RefreshCw className="w-10 h-10 mx-auto mb-3 animate-spin opacity-40" /><p>Načítám Don't Forget…</p>
    </div>
  )
  if (error) return <div className="p-4 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">{error}</div>

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm text-gray-500">
          {items.length > 0
            ? <span className="font-semibold text-indigo-600">{items.length} položek</span>
            : 'Prázdné'}
        </p>
        <button onClick={onRefresh}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-indigo-600 border border-gray-200 rounded-lg hover:border-indigo-300">
          <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} /> Obnovit
        </button>
      </div>

      {items.length === 0 ? (
        <div className="text-center py-16 text-gray-400">
          <Bookmark className="w-12 h-12 mx-auto mb-3 opacity-30" /><p>Don't Forget je prázdné</p>
        </div>
      ) : (
        <div className="rounded-xl border border-indigo-200 overflow-hidden">
          <div className="bg-indigo-50 px-4 py-2.5 text-xs font-semibold text-indigo-600 uppercase tracking-wide flex items-center gap-2">
            <Bookmark className="w-3.5 h-3.5" /> Don't Forget · {items.length}
          </div>
          <div className="bg-white divide-y divide-gray-100">
            {items.map((item, i) => (
              <a key={item.id || i} href={item.app_url} target="_blank" rel="noreferrer"
                className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 group">
                <Bookmark className="w-4 h-4 mt-0.5 text-indigo-400 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-gray-800 font-medium leading-snug">{item.title}</p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {item.bucket?.name && <span className="font-medium text-gray-500">{item.bucket.name}</span>}
                    {item.type && <><span className="mx-1">·</span>{RECORDING_LABELS[item.type] || item.type}</>}
                    {item.bookmarked_at && <><span className="mx-1">·</span>{new Date(item.bookmarked_at).toLocaleDateString('cs-CZ', { day: 'numeric', month: 'short' })}</>}
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
const REFRESH_INTERVAL = 15 * 60 * 1000 // 15 minut
const HIDDEN_TODOS_KEY = 'hiddenBcTodoIds'

export default function App() {
  const [tab, setTab] = useState('todos')
  const [todos, setTodos] = useState([])
  const [loading, setLoading] = useState(false)
  const [loadingMsg, setLoadingMsg] = useState('')
  const [error, setError] = useState(null)
  const [lastSync, setLastSync] = useState(null)
  const [collapsed, setCollapsed] = useState({})
  const [filterProject, setFilterProject] = useState('all')
  const [hiddenIds, setHiddenIds] = useState<Set<number>>(() => {
    try { return new Set(JSON.parse(localStorage.getItem(HIDDEN_TODOS_KEY) || '[]')) } catch { return new Set() }
  })
  const [showHidden, setShowHidden] = useState(false)

  const hideТodo = (id: number) => {
    setHiddenIds(prev => {
      const next = new Set(prev); next.add(id)
      localStorage.setItem(HIDDEN_TODOS_KEY, JSON.stringify([...next]))
      return next
    })
  }
  const unhideTodo = (id: number) => {
    setHiddenIds(prev => {
      const next = new Set(prev); next.delete(id)
      localStorage.setItem(HIDDEN_TODOS_KEY, JSON.stringify([...next]))
      return next
    })
  }

  const [notifUnreads, setNotifUnreads] = useState([])
  const [notifLoading, setNotifLoading] = useState(false)
  const [notifError, setNotifError] = useState(null)
  const [notifLastSync, setNotifLastSync] = useState(null)
  const [notifBadge, setNotifBadge] = useState(0)

  const [dontForget, setDontForget] = useState([])
  const [dontForgetLoading, setDontForgetLoading] = useState(false)
  const [dontForgetError, setDontForgetError] = useState(null)

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
        ? IS_LOCAL
          ? 'Nelze se připojit. Spusť: node basecamp-proxy.js'
          : 'Nelze se připojit k Basecamp API. Token mohl expirovat — aktualizuj BASECAMP_TOKEN v Netlify.'
        : 'Chyba načítání: ' + e.message)
    }
    setLoading(false)
  }, [])

  const loadNotifs = useCallback(async () => {
    setNotifLoading(true); setNotifError(null)
    try {
      const { data } = await apiFetch('/my/readings.json')
      const unreads = data?.unreads || []
      setNotifUnreads(unreads)
      setNotifLastSync(new Date())
      const seenIds = new Set(JSON.parse(localStorage.getItem(SEEN_NOTIFS_KEY) || '[]'))
      setNotifBadge(unreads.filter(n => !seenIds.has(String(n.id))).length)
    } catch (e) { setNotifError('Chyba: ' + e.message) }
    setNotifLoading(false)
  }, [])

  const loadDontForget = useCallback(async () => {
    setDontForgetLoading(true); setDontForgetError(null)
    try {
      const { data } = await apiFetch('/my/bookmarks.json')
      setDontForget(Array.isArray(data) ? data : (data?.bookmarks || []))
    } catch (e) { setDontForgetError('Chyba: ' + e.message) }
    setDontForgetLoading(false)
  }, [])

  useEffect(() => {
    load()
    loadNotifs()
    loadDontForget()
    const id = setInterval(() => { load(); loadNotifs() }, REFRESH_INTERVAL)
    return () => clearInterval(id)
  }, [load, loadNotifs, loadDontForget])

  const openTab = (key) => {
    setTab(key)
    if (key === 'notifications') {
      setNotifBadge(0)
      localStorage.setItem(SEEN_NOTIFS_KEY, JSON.stringify(notifUnreads.map(n => String(n.id))))
    }
  }

  const open = todos.filter(t => !t.completed)
  const projects = [...new Set(open.filter(t => !hiddenIds.has(t.id)).map(t => t.project))].sort()
  const visibleAll = filterProject === 'all' ? open : open.filter(t => t.project === filterProject)
  const visible = visibleAll.filter(t => !hiddenIds.has(t.id))
  const hidden = open.filter(t => hiddenIds.has(t.id))
  const grouped = {}
  for (const s of SECTIONS) {
    grouped[s.key] = visible
      .filter(t => t.section === s.key)
      .sort((a, b) => {
        if (!a.due && !b.due) return 0
        if (!a.due) return 1
        if (!b.due) return -1
        return a.due.localeCompare(b.due)
      })
  }
  const toggle = key => setCollapsed(c => ({ ...c, [key]: !c[key] }))

  const TABS = [
    { key: 'todos', label: 'Moje úkoly', badge: 0 },
    { key: 'notifications', label: 'Notifikace', badge: notifBadge },
    { key: 'dontforget', label: "Don't Forget", badge: dontForget.length },
    { key: 'private', label: 'Soukromé úkoly', badge: 0 },
  ]

  return (
    <div className="min-h-screen bg-gray-100">
      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 py-3 flex items-center justify-between">
        <div className="flex flex-col gap-0.5 min-w-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <img src="https://www.ruzovyslon.cz/assets/frontend/images/logo-cs.svg?v=3" alt="Růžový slon" className="h-5 sm:h-7 w-auto flex-shrink-0" />
            <span className="text-gray-300">·</span>
            <div className="flex-shrink-0" style={{overflow:'hidden', height:'22px'}}>
              <img src="https://logowik.com/content/uploads/images/basecamp-new3343.logowik.com.webp" alt="Basecamp" style={{height:'70px', marginTop:'-24px', width:'auto'}} />
            </div>
          </div>
          <p className="text-xs text-gray-400 truncate">
            Tereza Kucková ·{' '}
            {tab === 'todos' && (lastSync ? `aktualizováno ${lastSync.toLocaleTimeString('cs-CZ', { hour: '2-digit', minute: '2-digit' })}` : 'načítám…')}
            {tab === 'notifications' && 'notifikace'}
            {tab === 'dontforget' && "don't forget"}
            {tab === 'private' && 'soukromé úkoly'}
          </p>
        </div>
        {tab === 'todos' && (
          <button onClick={load} disabled={loading}
            className="flex items-center gap-1.5 px-3 sm:px-4 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 disabled:opacity-50 text-sm font-medium flex-shrink-0">
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
            <span className="hidden sm:inline">{loading ? 'Načítám…' : 'Aktualizovat'}</span>
          </button>
        )}
      </div>

      <div className="bg-white border-b border-gray-200 px-4 sm:px-6 overflow-x-auto">
        <div className="flex gap-1 min-w-max">
          {TABS.map(t => (
            <button key={t.key} onClick={() => openTab(t.key)}
              className={`px-4 py-3 text-sm font-medium border-b-2 transition-colors flex items-center gap-2 ${tab === t.key ? 'border-indigo-600 text-indigo-600' : 'border-transparent text-gray-500 hover:text-gray-700'}`}>
              {t.label}
              {t.badge > 0 && (
                <span className="bg-orange-500 text-white text-xs font-bold rounded-full min-w-[18px] h-[18px] flex items-center justify-center px-1">
                  {t.badge}
                </span>
              )}
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
                            <button onClick={() => hideТodo(todo.id)}
                              className="opacity-0 group-hover:opacity-100 p-1 hover:text-gray-600 text-gray-300 flex-shrink-0" title="Skrýt úkol">
                              <EyeOff className="w-3.5 h-3.5" />
                            </button>
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

            {hidden.length > 0 && (
              <div className="mb-4 rounded-xl border border-gray-200 overflow-hidden">
                <button onClick={() => setShowHidden(h => !h)}
                  className="w-full flex items-center gap-3 px-4 py-3 bg-gray-50 text-left hover:bg-gray-100">
                  <EyeOff className="w-4 h-4 text-gray-400 flex-shrink-0" />
                  <span className="font-semibold text-sm text-gray-400">Skryté</span>
                  <span className="ml-auto text-sm font-bold text-gray-400">{hidden.length}</span>
                  {showHidden ? <ChevronDown className="w-4 h-4 text-gray-400" /> : <ChevronRight className="w-4 h-4 text-gray-400" />}
                </button>
                {showHidden && (
                  <div className="bg-white divide-y divide-gray-100">
                    {hidden.map(todo => (
                      <div key={todo.id} className="flex items-start gap-3 px-4 py-3 hover:bg-gray-50 group opacity-50">
                        <Circle className="w-4 h-4 mt-0.5 text-gray-300 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-gray-500 leading-snug">{todo.content}</p>
                          <p className="text-xs text-gray-400 mt-0.5 truncate">
                            {todo.project}<span className="mx-1">·</span>{todo.list}
                            {todo.due && <><span className="mx-1">·</span>{formatDate(todo.due)}</>}
                          </p>
                        </div>
                        <button onClick={() => unhideTodo(todo.id)}
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-600 text-gray-300 flex-shrink-0" title="Odkrýt úkol">
                          <Eye className="w-3.5 h-3.5" />
                        </button>
                        <a href={todo.url} target="_blank" rel="noreferrer"
                          className="opacity-0 group-hover:opacity-100 p-1 hover:text-indigo-600 text-gray-400 flex-shrink-0" title="Otevřít v Basecamp">
                          <ExternalLink className="w-3.5 h-3.5" />
                        </a>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}

            {!loading && visible.length === 0 && todos.length > 0 && (
              <div className="text-center py-16 text-gray-400">
                <CheckCircle2 className="w-12 h-12 mx-auto mb-3 opacity-40" /><p>Žádné otevřené úkoly</p>
              </div>
            )}
          </>
        )}

        {tab === 'notifications' && (
          <NotificationsTab
            unreads={notifUnreads}
            loading={notifLoading}
            error={notifError}
            lastSync={notifLastSync}
            onRefresh={loadNotifs}
          />
        )}
        {tab === 'dontforget' && (
          <DontForgetTab
            items={dontForget}
            loading={dontForgetLoading}
            error={dontForgetError}
            onRefresh={loadDontForget}
          />
        )}
        {tab === 'private' && <PrivateTodosTab />}
      </div>
    </div>
  )
}
