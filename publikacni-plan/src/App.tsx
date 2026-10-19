import { ChevronLeft, ChevronRight, Download, Menu, Plus, Search } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Agenda } from './components/Agenda'
import { AkceModal, type AkceDraft } from './components/AkceModal'
import { groupByMonth, ListView, type Row } from './components/ListView'
import { Login } from './components/Login'
import { MonthCalendar, pubHue } from './components/MonthCalendar'
import { PublikaceModal, type PublikaceDraft } from './components/PublikaceModal'
import { SettingsView } from './components/SettingsView'
import { Logo, Sidebar } from './components/Sidebar'
import { Button, cx, inputClass, Segmented, Spinner, toggle, useToast } from './components/ui'
import { type TimelineItem, YearTimeline } from './components/YearTimeline'
import { isDemo } from './config'
import { movePublikace, resetDemo, useAkce, useAuth, useLists, usePublikace } from './data/store'
import { hue } from './lib/colors'
import { download, toCsv } from './lib/csv'
import { addDays, daysInMonth, formatDate, formatRange, iso, monthOf, monthTitle, todayISO, yearOf, type ISODate } from './lib/dates'
import { isFiltered, matchAkce, matchPublikace } from './lib/filters'
import { domainSummary } from './lib/format'
import { type Akce, brandsOf, emptyLinks, type Lists, type Person, type Publikace, SIGNIFICANT_DAY, splitDomain, STATUS, statusOf, uniq } from './lib/model'
import { type Mode, useUrlState } from './lib/urlState'

export default function App() {
  const auth = useAuth()
  if (auth.status === 'loading') return <Spinner label="Přihlašuji…" />
  if (auth.status === 'out') return <Login error={auth.error} />
  return <Planner person={auth.person} photo={auth.user.photoURL} />
}

type Dialog =
  | { kind: 'p'; draft: PublikaceDraft; key: number }
  | { kind: 'a'; draft: AkceDraft; key: number }

const GROUPS: Record<'akce' | 'publikace', [string, string][]> = {
  akce: [['typ', 'Typ'], ['znacka', 'Značka'], ['domena', 'Doména']],
  publikace: [['kanal', 'Kanál'], ['znacka', 'Značka'], ['domena', 'Doména'], ['akce', 'Akce']],
}

const ALL_BRANDS = 'Všechny značky'
const ALL_DOMAINS = 'Všechny domény'
const NO_AKCE = 'Bez akce'

let dialogKey = 0

const plural = (n: number, one: string, few: string, many: string) => `${n} ${n === 1 ? one : n >= 2 && n <= 4 ? few : many}`

function Planner({ person, photo }: { person: Person; photo: string | null }) {
  const [state, update] = useUrlState()
  const toast = useToast()
  const today = todayISO()
  const { year, month0, view, filters } = state
  const pubs = usePublikace(year, true)
  const akceLive = useAkce(true)
  const lists = useLists(true)
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [menuOpen, setMenuOpen] = useState(false)

  // "What goes out next" always looks at today, whatever month is on screen.
  const agendaYears = [yearOf(today), yearOf(addDays(today, 13))]
  const agendaA = usePublikace(agendaYears[0], view === 'kalendar')
  const agendaB = usePublikace(agendaYears[1], view === 'kalendar' && agendaYears[1] !== agendaYears[0])

  const allAkce = useMemo(() => akceLive.data ?? [], [akceLive.data])
  const allPubs = useMemo(() => pubs.data ?? [], [pubs.data])
  const akceById = useMemo(() => new Map(allAkce.map((a) => [a.id, a])), [allAkce])
  const fa = useMemo(() => allAkce.filter((a) => matchAkce(a, filters)), [allAkce, filters])
  const fp = useMemo(() => allPubs.filter((p) => matchPublikace(p, filters)), [allPubs, filters])
  const agendaPubs = useMemo(() => {
    const byId = new Map([...(agendaA.data ?? []), ...(agendaB.data ?? [])].map((p) => [p.id, p]))
    return [...byId.values()].filter((p) => matchPublikace(p, filters))
  }, [agendaA.data, agendaB.data, filters])
  const loading = pubs.data === null || akceLive.data === null
  const error = pubs.error || akceLive.error

  const periodFrom = view === 'kalendar' ? iso(year, month0, 1) : iso(year, 0, 1)
  const periodTo = view === 'kalendar' ? iso(year, month0, daysInMonth(year, month0)) : iso(year, 11, 31)
  const inPeriod = (x: { dateFrom: string; dateTo: string }) => x.dateFrom <= periodTo && x.dateTo >= periodFrom
  const pubCount = fp.filter(inPeriod).length
  const akceCount = fa.filter((a) => a.type !== SIGNIFICANT_DAY && inPeriod(a)).length
  const brandCounts = useMemo(() => {
    const counts = new Map<string, number>()
    for (const p of allPubs) {
      if (p.dateFrom > periodTo || p.dateTo < periodFrom) continue
      for (const b of brandsOf(p.domains)) counts.set(b, (counts.get(b) ?? 0) + 1)
    }
    return counts
  }, [allPubs, periodFrom, periodTo])

  const openPublikace = (id: string) => {
    const p = allPubs.find((x) => x.id === id) ?? agendaPubs.find((x) => x.id === id)
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

  const legendClick = state.colors === 'kanal'
    ? (k: string) => update({ filters: { ...filters, channels: toggle(filters.channels, k) } })
    : state.colors === 'znacka'
      ? (k: string) => update({ filters: { ...filters, brands: toggle(filters.brands, k) } })
      : undefined

  const sidebar = (onClose?: () => void) => (
    <Sidebar
      view={view}
      onView={(v) => update({ view: v })}
      lists={lists}
      filters={filters}
      onFilters={(f) => update({ filters: f })}
      showChannels={view === 'kalendar' || mode !== 'akce'}
      brandCounts={brandCounts}
      person={person}
      photo={photo}
      onNewPublikace={() => { onClose?.(); newPublikace() }}
      onNewAkce={() => { onClose?.(); newAkce() }}
      onClose={onClose}
    />
  )

  return (
    <div className="min-h-screen bg-canvas text-ink lg:grid lg:grid-cols-[272px_minmax(0,1fr)]">
      <div className="hidden border-r border-line lg:sticky lg:top-0 lg:block lg:h-screen">{sidebar()}</div>

      {menuOpen && (
        <div className="fade-in fixed inset-0 z-40 bg-ink/30 lg:hidden" onMouseDown={(e) => e.target === e.currentTarget && setMenuOpen(false)}>
          <div className="h-full w-[296px] max-w-[88vw] border-r border-line shadow-panel">{sidebar(() => setMenuOpen(false))}</div>
        </div>
      )}

      <div className="min-w-0">
        {isDemo && (
          <div className="flex flex-wrap items-center justify-center gap-x-3 gap-y-1 bg-accent-soft px-4 py-2 text-center text-xs text-ink">
            <span><strong>Ukázka</strong> s daty ze staré appky. Změny se ukládají jen v tomto prohlížeči, ostatní je neuvidí.</span>
            <button type="button" className="rounded-md px-2 py-0.5 font-bold text-accent ring-1 ring-accent/40 hover:bg-accent/10" onClick={() => { resetDemo(); toast('Ukázka je zase na začátku') }}>
              Začít znovu
            </button>
          </div>
        )}

        <div className="sticky top-[env(safe-area-inset-top,0px)] z-30 flex items-center gap-3 border-b border-line bg-surface/90 px-4 py-2.5 backdrop-blur lg:hidden">
          <button type="button" onClick={() => setMenuOpen(true)} className="rounded-lg p-1.5 text-muted hover:bg-raised" aria-label="Menu a filtry">
            <Menu className="size-5" />
          </button>
          <span className="font-display font-semibold text-ink">Publikační plán</span>
          {isFiltered(filters) && <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">filtr</span>}
          <Button variant="primary" className="ml-auto px-2.5" onClick={() => newPublikace()} aria-label="Nová publikace"><Plus className="size-4" /></Button>
        </div>

        <main className="space-y-6 px-4 py-5 sm:px-6 lg:px-8 lg:py-7">
          {view === 'nastaveni' ? (
            <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">Nastavení</h1>
          ) : (
            <div className="flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
              <div className="min-w-0">
                <h1 className="font-display text-3xl leading-tight font-semibold tracking-tight text-ink tabular-nums sm:text-4xl">
                  {view === 'kalendar' ? monthTitle(year, month0) : year}
                </h1>
                <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-2">
                  <div className="flex items-center rounded-lg bg-surface ring-1 ring-line">
                    <button type="button" onClick={() => shift(-1)} className="rounded-l-lg p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Předchozí"><ChevronLeft className="size-5" /></button>
                    <button type="button" onClick={goToday} className="border-x border-line px-2.5 py-1 text-xs font-bold text-muted hover:bg-raised hover:text-ink">Dnes</button>
                    <button type="button" onClick={() => shift(1)} className="rounded-r-lg p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Další"><ChevronRight className="size-5" /></button>
                  </div>
                  <p className="text-sm text-muted">
                    {plural(pubCount, 'publikace', 'publikace', 'publikací')} · {plural(akceCount, 'akce', 'akce', 'akcí')} v plánu
                    {isFiltered(filters) && <span className="font-semibold text-accent"> · filtrováno</span>}
                  </p>
                </div>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                {view === 'kalendar' && (
                  <Segmented label="Barvy podle" value={state.colors} onChange={(colors) => update({ colors })} options={[['kanal', 'Kanály'], ['znacka', 'Značky'], ['akce', 'Akce']]} />
                )}
                {view === 'rok' && (
                  <>
                    <Segmented label="Co zobrazit" value={mode} onChange={(m) => update({ mode: m, group: '' })} options={[['akce', 'Roční plán'], ['publikace', 'Publikace']]} />
                    <Segmented label="Řádky podle" value={groupKey} onChange={(group) => update({ group })} options={GROUPS[mode as 'akce' | 'publikace']} />
                  </>
                )}
                {view === 'seznam' && (
                  <>
                    <Segmented label="Co zobrazit" value={mode} onChange={(m) => update({ mode: m })} options={[['akce', 'Roční plán'], ['publikace', 'Publikace'], ['vse', 'Vše']]} />
                    <Button variant="ghost" onClick={() => (isDemo ? toast('V ukázce se soubory nestahují, v ostré verzi ano.') : exportCsv(listRows(mode, fa, fp), year, akceById, lists, today))}>
                      <Download className="size-4" /> Excel
                    </Button>
                  </>
                )}
                <label className="relative w-full sm:w-56">
                  <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-faint" />
                  <input className={cx(inputClass, 'pl-8')} type="search" value={filters.q} onChange={(e) => update({ filters: { ...filters, q: e.target.value } })} placeholder="Hledat…" aria-label="Hledat" />
                </label>
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl bg-danger/10 px-4 py-3 text-sm text-danger" role="alert">
              Nemám přístup k datům: {error}. Pokud se to děje všem, zkontroluj, že jsou ve Firebase nasazená pravidla z <code>firestore.rules</code>.
            </div>
          )}

          {view === 'nastaveni' ? (
            <SettingsView key={JSON.stringify(lists)} lists={lists} akce={allAkce} person={person} year={year} />
          ) : loading && !error ? (
            <Spinner />
          ) : (
            <>
              {allPubs.length === 0 && allAkce.length === 0 && !error && (
                <div className="flex flex-wrap items-center gap-3 rounded-2xl bg-accent-soft px-5 py-4 text-sm text-ink">
                  <Logo />
                  <span className="flex-1">Plán je zatím prázdný. Začni importem dat ze staré appky a doplněním významných dnů.</span>
                  <Button variant="primary" onClick={() => update({ view: 'nastaveni' })}>Otevřít nastavení</Button>
                </div>
              )}
              {view === 'kalendar' && (
                <div className="grid grid-cols-[minmax(0,1fr)] items-start gap-6 2xl:grid-cols-[minmax(0,1fr)_300px]">
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
                    onLegend={legendClick}
                    activeLegend={state.colors === 'kanal' ? filters.channels : state.colors === 'znacka' ? filters.brands : []}
                  />
                  <Agenda
                    className="max-md:order-first 2xl:sticky 2xl:top-6 2xl:max-h-[calc(100vh-3rem)] 2xl:overflow-y-auto 2xl:pr-1"
                    today={today}
                    publikace={agendaPubs}
                    akce={fa}
                    allDomains={lists.domains}
                    onOpen={open}
                  />
                </div>
              )}
              {view === 'rok' && (
                <YearTimeline
                  year={year}
                  today={today}
                  items={timelineItems(mode === 'publikace' ? 'publikace' : 'akce', groupKey, fa, fp, akceById, today, lists)}
                  groupOrder={groupOrder(mode === 'publikace' ? 'publikace' : 'akce', groupKey, fa, fp, lists, akceById)}
                  groupHue={(g) => groupHue(groupKey, g)}
                  significant={fa.filter((a) => a.type === SIGNIFICANT_DAY)}
                  compact={mode === 'publikace'}
                  onOpen={open}
                />
              )}
              {view === 'seznam' && <ListView year={year} today={today} rows={listRows(mode, fa, fp)} akceById={akceById} allDomains={lists.domains} onOpen={open} />}
            </>
          )}
        </main>
      </div>

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

function groupHue(group: string, name: string): string | undefined {
  if (name === ALL_BRANDS || name === ALL_DOMAINS || name === NO_AKCE || group === 'akce') return undefined
  return hue(group === 'domena' ? splitDomain(name).brand : name)
}

function timelineItems(kind: 'akce' | 'publikace', group: string, akce: Akce[], pubs: Publikace[], akceById: Map<string, Akce>, today: ISODate, lists: Lists): TimelineItem[] {
  if (kind === 'akce') {
    return akce.filter((a) => a.type !== SIGNIFICANT_DAY).map((a) => ({
      id: a.id, kind: 'akce', name: a.name, dateFrom: a.dateFrom, dateTo: a.dateTo,
      hue: hue(group === 'typ' ? brandsOf(a.domains)[0] ?? a.type : a.type),
      faded: statusOf(a, today) === 'ukoncena',
      groups: groupsOf(kind, group, a, akceById),
      title: [`${a.type}: ${a.name}`, formatRange(a.dateFrom, a.dateTo), a.benefit, domainSummary(a.domains, lists.domains)].filter(Boolean).join('\n'),
    }))
  }
  return pubs.map((p) => ({
    id: p.id, kind: 'publikace', name: p.name, dateFrom: p.dateFrom, dateTo: p.dateTo,
    hue: pubHue(p, group === 'kanal' ? 'znacka' : 'kanal', akceById),
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
