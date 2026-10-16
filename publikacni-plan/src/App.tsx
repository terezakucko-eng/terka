import { CalendarDays, ChevronLeft, ChevronRight, Download, GanttChart, List, LogOut, Plus, Settings } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { AkceModal, type AkceDraft } from './components/AkceModal'
import { FilterBar } from './components/FilterBar'
import { groupByMonth, ListView, type Row } from './components/ListView'
import { Login } from './components/Login'
import { MonthCalendar, pubSwatch } from './components/MonthCalendar'
import { PublikaceModal, type PublikaceDraft } from './components/PublikaceModal'
import { SettingsView } from './components/SettingsView'
import { Button, cx, Segmented, Spinner, useToast } from './components/ui'
import { type TimelineItem, YearTimeline } from './components/YearTimeline'
import { logOut, movePublikace, useAkce, useAuth, useLists, usePublikace } from './data/store'
import { swatch } from './lib/colors'
import { download, toCsv } from './lib/csv'
import { formatDate, formatRange, iso, monthOf, monthTitle, todayISO, yearOf, type ISODate } from './lib/dates'
import { matchAkce, matchPublikace } from './lib/filters'
import { domainSummary } from './lib/format'
import { type Akce, brandsOf, emptyLinks, type Lists, type Person, type Publikace, SIGNIFICANT_DAY, STATUS, statusOf, uniq } from './lib/model'
import { type Mode, useUrlState, type View } from './lib/urlState'

export default function App() {
  const auth = useAuth()
  if (auth.status === 'loading') return <Spinner label="Přihlašuji…" />
  if (auth.status === 'out') return <Login error={auth.error} />
  return <Planner person={auth.person} photo={auth.user.photoURL} />
}

type Dialog =
  | { kind: 'p'; draft: PublikaceDraft; key: number }
  | { kind: 'a'; draft: AkceDraft; key: number }

const TABS: [View, string, typeof CalendarDays][] = [
  ['kalendar', 'Kalendář', CalendarDays],
  ['rok', 'Rok', GanttChart],
  ['seznam', 'Seznam', List],
  ['nastaveni', 'Nastavení', Settings],
]

const GROUPS: Record<'akce' | 'publikace', [string, string][]> = {
  akce: [['typ', 'Typ akce'], ['znacka', 'Značka'], ['domena', 'Doména']],
  publikace: [['kanal', 'Kanál'], ['znacka', 'Značka'], ['domena', 'Doména'], ['akce', 'Akce']],
}

const ALL_BRANDS = 'Všechny značky'
const ALL_DOMAINS = 'Všechny domény'
const NO_AKCE = 'Bez akce'

let dialogKey = 0

function Planner({ person, photo }: { person: Person; photo: string | null }) {
  const [state, update] = useUrlState()
  const toast = useToast()
  const today = todayISO()
  const { year, month0, view, filters } = state
  const pubs = usePublikace(year, true)
  const akceLive = useAkce(true)
  const lists = useLists(true)
  const [dialog, setDialog] = useState<Dialog | null>(null)

  const allAkce = useMemo(() => akceLive.data ?? [], [akceLive.data])
  const allPubs = useMemo(() => pubs.data ?? [], [pubs.data])
  const akceById = useMemo(() => new Map(allAkce.map((a) => [a.id, a])), [allAkce])
  const fa = useMemo(() => allAkce.filter((a) => matchAkce(a, filters)), [allAkce, filters])
  const fp = useMemo(() => allPubs.filter((p) => matchPublikace(p, filters)), [allPubs, filters])
  const loading = pubs.data === null || akceLive.data === null
  const error = pubs.error || akceLive.error

  const openPublikace = (id: string) => {
    const p = allPubs.find((x) => x.id === id)
    if (!p) return toast('Publikace nebyla nalezena (možná je v jiném roce).', 'error')
    setDialog({ kind: 'p', draft: { ...p }, key: ++dialogKey })
    update({ open: `p:${id}` })
  }
  const openAkce = (id: string) => {
    const a = akceById.get(id)
    if (!a) return toast('Akce nebyla nalezena.', 'error')
    setDialog({ kind: 'a', draft: { ...a }, key: ++dialogKey })
    update({ open: `a:${id}` })
  }
  const open = (kind: 'akce' | 'publikace', id: string) => (kind === 'akce' ? openAkce(id) : openPublikace(id))
  const closeDialog = () => {
    setDialog(null)
    update({ open: null })
  }

  // A shared link opens its item once the data is in.
  const deepLink = useRef(state.open)
  useEffect(() => {
    const target = deepLink.current
    if (!target || loading) return
    deepLink.current = null
    const [kind, id] = [target.slice(0, 1), target.slice(2)]
    if (kind === 'p') openPublikace(id)
    else if (kind === 'a') openAkce(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading])

  const defaultDate = (): ISODate => (yearOf(today) === year && monthOf(today) === month0 ? today : iso(year, view === 'kalendar' ? month0 : 0, 1))

  const newPublikace = (date: ISODate = defaultDate(), over: Partial<PublikaceDraft> = {}) =>
    setDialog({
      kind: 'p',
      key: ++dialogKey,
      draft: { id: null, name: '', dateFrom: date, dateTo: date, channels: [], domains: [], akceId: null, description: '', links: emptyLinks(), ready: false, ...over },
    })

  const newAkce = () =>
    setDialog({
      kind: 'a',
      key: ++dialogKey,
      draft: { id: null, name: '', type: lists.akceTypes[0] ?? 'Hlavní kampaň', dateFrom: defaultDate(), dateTo: defaultDate(), domains: [], benefit: '', info: '', links: emptyLinks() },
    })

  const move = async (p: Publikace, dateFrom: ISODate, dateTo: ISODate) => {
    try {
      await movePublikace(p.id, dateFrom, dateTo, person)
      toast(`„${p.name}“ přesunuto na ${formatRange(dateFrom, dateTo)}`, 'ok', { label: 'Vrátit', run: () => void movePublikace(p.id, p.dateFrom, p.dateTo, person) })
    } catch (e) {
      toast(`Přesun se nepovedl: ${(e as Error).message}`, 'error')
    }
  }

  const shift = (step: number) => {
    if (view === 'kalendar') {
      const m = year * 12 + month0 + step
      update({ year: Math.floor(m / 12), month0: ((m % 12) + 12) % 12 })
    } else update({ year: year + step })
  }

  const goToday = () => update({ year: yearOf(today), month0: monthOf(today) })

  const mode: Mode = view === 'rok' && state.mode === 'vse' ? 'akce' : state.mode
  const groupKey = view === 'rok' && mode !== 'vse' ? (GROUPS[mode].some(([g]) => g === state.group) ? state.group : GROUPS[mode][0][0]) : ''

  return (
    <div className="min-h-screen bg-slate-50 text-slate-800">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/90 backdrop-blur">
        <div className="mx-auto flex max-w-[1600px] flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2.5">
          <div className="flex items-center gap-2">
            <span className="text-2xl" aria-hidden>🐘</span>
            <div className="leading-tight">
              <h1 className="text-base font-bold text-slate-900">Publikační plán</h1>
              <p className="text-[11px] text-slate-500">Růžový Slon · Kondomshop · Flagranti</p>
            </div>
          </div>
          <nav className="order-last flex w-full gap-1 overflow-x-auto md:order-none md:w-auto" aria-label="Pohledy">
            {TABS.map(([v, label, Icon]) => (
              <button
                key={v}
                type="button"
                onClick={() => update({ view: v })}
                aria-current={view === v ? 'page' : undefined}
                className={cx('inline-flex items-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium whitespace-nowrap', view === v ? 'bg-pink-50 text-pink-700' : 'text-slate-600 hover:bg-slate-100')}
              >
                <Icon className="size-4" /> {label}
              </button>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-2">
            <Button variant="primary" onClick={() => newPublikace()}><Plus className="size-4" /> Publikace</Button>
            <Button onClick={newAkce}><Plus className="size-4" /> Akce</Button>
            <div className="flex items-center gap-2 border-l border-slate-200 pl-3" title={person.email}>
              {photo ? <img src={photo} alt="" className="size-7 rounded-full" referrerPolicy="no-referrer" /> : <span className="flex size-7 items-center justify-center rounded-full bg-pink-100 text-xs font-bold text-pink-700">{person.name.slice(0, 1)}</span>}
              <span className="hidden text-sm text-slate-700 lg:inline">{person.name}</span>
              <button type="button" onClick={() => void logOut()} className="rounded-lg p-1.5 text-slate-500 hover:bg-slate-100" title="Odhlásit" aria-label="Odhlásit">
                <LogOut className="size-4" />
              </button>
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] space-y-4 px-4 py-4">
        {error && (
          <div className="rounded-xl bg-red-50 px-4 py-3 text-sm text-red-800 ring-1 ring-red-200" role="alert">
            Nemám přístup k datům: {error}. Pokud se to děje všem, zkontroluj, že jsou ve Firebase nasazená pravidla z <code>firestore.rules</code>.
          </div>
        )}

        {view !== 'nastaveni' && (
          <div className="space-y-3 rounded-xl bg-white p-3 ring-1 ring-slate-200">
            <div className="flex flex-wrap items-center gap-3">
              <div className="flex items-center gap-1">
                <Button variant="ghost" onClick={() => shift(-1)} aria-label="Předchozí"><ChevronLeft className="size-5" /></Button>
                <h2 className="min-w-40 text-center text-lg font-semibold text-slate-900 tabular-nums">{view === 'kalendar' ? monthTitle(year, month0) : year}</h2>
                <Button variant="ghost" onClick={() => shift(1)} aria-label="Další"><ChevronRight className="size-5" /></Button>
                <Button variant="ghost" onClick={goToday} className="text-xs">Dnes</Button>
              </div>
              {view === 'kalendar' && (
                <label className="flex items-center gap-2 text-sm text-slate-600">
                  Barvy podle
                  <Segmented value={state.colors} onChange={(colors) => update({ colors })} options={[['kanal', 'kanálu'], ['akce', 'akce'], ['znacka', 'značky']]} />
                </label>
              )}
              {view === 'rok' && (
                <>
                  <Segmented value={mode} onChange={(m) => update({ mode: m, group: '' })} options={[['akce', 'Roční plán'], ['publikace', 'Publikace']]} />
                  <label className="flex items-center gap-2 text-sm text-slate-600">
                    Řádky podle
                    <Segmented value={groupKey} onChange={(group) => update({ group })} options={GROUPS[mode as 'akce' | 'publikace']} />
                  </label>
                </>
              )}
              {view === 'seznam' && (
                <>
                  <Segmented value={mode} onChange={(m) => update({ mode: m })} options={[['akce', 'Roční plán'], ['publikace', 'Publikace'], ['vse', 'Vše']]} />
                  <Button variant="ghost" onClick={() => exportCsv(listRows(mode, fa, fp), year, akceById, lists, today)}><Download className="size-4" /> Export pro Excel</Button>
                </>
              )}
            </div>
            <FilterBar lists={lists} filters={filters} onChange={(f) => update({ filters: f })} showChannels={view === 'kalendar' || mode !== 'akce'} />
          </div>
        )}

        {view === 'nastaveni' ? (
          <SettingsView key={JSON.stringify(lists)} lists={lists} akce={allAkce} person={person} year={year} />
        ) : loading && !error ? (
          <Spinner />
        ) : (
          <>
            {allPubs.length === 0 && allAkce.length === 0 && !error && (
              <div className="rounded-xl bg-pink-50 px-4 py-3 text-sm text-pink-900 ring-1 ring-pink-200">
                Plán je zatím prázdný. V <button type="button" className="font-semibold underline" onClick={() => update({ view: 'nastaveni' })}>Nastavení</button> můžeš naimportovat data ze staré appky a doplnit významné dny.
              </div>
            )}
            {view === 'kalendar' && (
              <MonthCalendar
                year={year}
                month0={month0}
                today={today}
                publikace={fp}
                akce={fa}
                allDomains={lists.domains}
                colorBy={state.colors}
                onOpenPublikace={openPublikace}
                onOpenAkce={openAkce}
                onNew={(d) => newPublikace(d)}
                onMove={move}
              />
            )}
            {view === 'rok' && (
              <YearTimeline
                year={year}
                today={today}
                items={timelineItems(mode === 'publikace' ? 'publikace' : 'akce', groupKey, fa, fp, akceById, today, lists)}
                groupOrder={groupOrder(mode === 'publikace' ? 'publikace' : 'akce', groupKey, fa, fp, lists, akceById)}
                significant={fa.filter((a) => a.type === SIGNIFICANT_DAY)}
                compact={mode === 'publikace'}
                onOpen={open}
              />
            )}
            {view === 'seznam' && <ListView year={year} today={today} rows={listRows(mode, fa, fp)} akceById={akceById} allDomains={lists.domains} onOpen={open} />}
          </>
        )}
      </main>

      {dialog?.kind === 'p' && (
        <PublikaceModal
          key={dialog.key}
          draft={dialog.draft}
          lists={lists}
          akce={allAkce}
          person={person}
          today={today}
          onClose={closeDialog}
          onDuplicate={(draft) => setDialog({ kind: 'p', draft, key: ++dialogKey })}
          onOpenAkce={openAkce}
        />
      )}
      {dialog?.kind === 'a' && (
        <AkceModal
          key={dialog.key}
          draft={dialog.draft}
          lists={lists}
          publikace={allPubs}
          person={person}
          onClose={closeDialog}
          onOpenPublikace={openPublikace}
          onAddPublikace={(akceId, a) => newPublikace(a.dateFrom, { dateTo: a.dateTo, domains: a.domains, akceId })}
        />
      )}
    </div>
  )
}

function listRows(mode: Mode, akce: Akce[], pubs: Publikace[]): Row[] {
  return [
    ...(mode !== 'publikace' ? akce.map((item): Row => ({ kind: 'akce', item })) : []),
    ...(mode !== 'akce' ? pubs.map((item): Row => ({ kind: 'publikace', item })) : []),
  ]
}

function groupsOf(kind: 'akce' | 'publikace', group: string, item: Akce | Publikace, akceById: Map<string, Akce>): string[] {
  if (group === 'typ') return [(item as Akce).type]
  if (group === 'kanal') return (item as Publikace).channels
  if (group === 'znacka') return item.domains.length ? brandsOf(item.domains) : [ALL_BRANDS]
  if (group === 'domena') return item.domains.length ? item.domains : [ALL_DOMAINS]
  if (group === 'akce' && kind === 'publikace') {
    const a = (item as Publikace).akceId ? akceById.get((item as Publikace).akceId!) : undefined
    return [a ? a.name : NO_AKCE]
  }
  return []
}

function timelineItems(kind: 'akce' | 'publikace', group: string, akce: Akce[], pubs: Publikace[], akceById: Map<string, Akce>, today: ISODate, lists: Lists): TimelineItem[] {
  if (kind === 'akce') {
    return akce.filter((a) => a.type !== SIGNIFICANT_DAY).map((a) => ({
      id: a.id, kind: 'akce', name: a.name, dateFrom: a.dateFrom, dateTo: a.dateTo,
      swatch: swatch(group === 'typ' ? brandsOf(a.domains)[0] ?? a.type : a.type),
      faded: statusOf(a, today) === 'ukoncena',
      groups: groupsOf(kind, group, a, akceById),
      title: [`${a.type}: ${a.name}`, formatRange(a.dateFrom, a.dateTo), a.benefit, domainSummary(a.domains, lists.domains)].filter(Boolean).join('\n'),
    }))
  }
  return pubs.map((p) => ({
    id: p.id, kind: 'publikace', name: p.name, dateFrom: p.dateFrom, dateTo: p.dateTo,
    swatch: pubSwatch(p, group === 'kanal' ? 'znacka' : 'kanal', akceById),
    faded: statusOf(p, today) === 'ukoncena',
    groups: groupsOf(kind, group, p, akceById),
    title: [p.name, formatRange(p.dateFrom, p.dateTo), p.channels.join(', '), domainSummary(p.domains, lists.domains)].filter(Boolean).join('\n'),
  }))
}

function groupOrder(kind: 'akce' | 'publikace', group: string, akce: Akce[], pubs: Publikace[], lists: Lists, akceById: Map<string, Akce>): string[] {
  const used = uniq((kind === 'akce' ? akce.filter((a) => a.type !== SIGNIFICANT_DAY) : pubs).flatMap((i) => groupsOf(kind, group, i, akceById)))
  const base =
    group === 'typ' ? lists.akceTypes
      : group === 'kanal' ? lists.channels
      : group === 'znacka' ? [...brandsOf(lists.domains), ALL_BRANDS]
      : group === 'domena' ? [...lists.domains, ALL_DOMAINS]
      : [...akce].sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)).map((a) => a.name).concat(NO_AKCE)
  return uniq([...base.filter((g) => used.includes(g)), ...used])
}

function exportCsv(rows: Row[], year: number, akceById: Map<string, Akce>, lists: Lists, today: ISODate) {
  const header = ['Záznam', 'Stav', 'Název', 'Od', 'Do', 'Typ / kanály', 'Domény', 'Akce', 'Dárek / benefit', 'Popis / info', 'Basecamp', 'Soupis produktů', 'Rodný list', 'Grafika', 'SMS']
  const body = groupByMonth(rows, year).flatMap(([, rs]) => rs).map((r) => {
    const i = r.item
    return [
      r.kind === 'akce' ? 'Roční plán' : 'Publikace',
      STATUS[statusOf(i, today)].label,
      i.name,
      formatDate(i.dateFrom),
      formatDate(i.dateTo),
      r.kind === 'akce' ? r.item.type : r.item.channels.join(', '),
      domainSummary(i.domains, lists.domains),
      r.kind === 'publikace' && r.item.akceId ? akceById.get(r.item.akceId)?.name ?? '' : '',
      r.kind === 'akce' ? r.item.benefit : '',
      r.kind === 'akce' ? r.item.info : r.item.description,
      i.links.basecamp, i.links.products, i.links.birthSheet, i.links.graphics, i.links.sms,
    ]
  })
  download(`publikacni-plan-${year}.csv`, toCsv([header, ...body]))
}
