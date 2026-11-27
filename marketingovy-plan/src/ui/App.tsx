import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { type Data, Store } from '../data/store'
import { SheetError, type SheetsApi } from '../data/sheets'
import { shiftToYear } from '../lib/calendar'
import { addDays, formatDate, monthOf, todayISO, yearOf, type ISODate } from '../lib/dates'
import {
  allBrands, brandColor, channelGroups, STATUS, STATUS_FLOW, type Activity, type ActivityInput, type CompetitorInput, type ResultInput,
} from '../lib/model'
import { norm } from '../lib/parse'
import { suggestions as buildSuggestions } from '../lib/recommend'
import { applyFilters, filtersActive, noFilters, resultsById, type Filters } from '../lib/stats'
import { effectiveStatus } from '../lib/status'
import { CalendarView, initialCalendar, type CalendarState } from './Calendar'
import { CompetitorsView } from './Competitors'
import { Confirm, remember, Toasts, useToasts, vivid } from './common'
import { type Ctx, type View, VIEWS } from './ctx'
import { EvaluationView } from './Evaluation'
import { ActivityDrawer, BulkEvaluate, CompetitorForm, ResultDialog } from './Forms'
import { ListView } from './List'
import { RecommendView } from './Recommend'
import { YearlyView } from './Yearly'

export interface AppProps {
  api: SheetsApi
  who: string
  /** True when the page runs without the person's connection to the spreadsheet: example data, kept only in this window. */
  demo: boolean
  /** The connection cannot write; everything is read-only. */
  readOnly?: boolean
  saveFile?: (filename: string, content: string) => Promise<void>
}

type Dialog =
  | { kind: 'activity'; id: string }
  | { kind: 'new'; prefill: Partial<ActivityInput>; suggestionKey?: string }
  | { kind: 'result'; id: string }
  | { kind: 'bulk'; ids: string[] }
  | { kind: 'rival'; date: ISODate }
  | { kind: 'remove'; ids: string[] }

const viewFromHash = (): View => {
  const h = (typeof location !== 'undefined' ? location.hash : '').replace(/^#/, '')
  return VIEWS.some(([v]) => v === h) ? (h as View) : 'kalendar'
}

const errorText = (e: unknown): string => (e instanceof SheetError ? e.message : 'Něco se nepovedlo. Zkus to znovu.')

const plural = (n: number, one: string, few: string, many: string): string => (n === 1 ? one : n >= 2 && n <= 4 ? few : many)

export function App({ api, who, demo, readOnly: connectionReadOnly, saveFile }: AppProps) {
  const store = useMemo(() => new Store(api, () => who || 'Neznámý'), [api, who])
  const [data, setData] = useState<Data | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [view, setView] = useState<View>(viewFromHash)
  const [filters, setFilters] = useState<Filters>(noFilters)
  const [brandsOff, setBrandsOff] = useState<string[]>([])
  const [cal, setCal] = useState<CalendarState>(() => initialCalendar(todayISO()))
  const [evalYear, setEvalYear] = useState(yearOf(todayISO()))
  const [yearlyYear, setYearlyYear] = useState(yearOf(todayISO()))
  const [dialog, setDialog] = useState<Dialog | null>(null)
  const [filtersOpen, setFiltersOpen] = useState(false)
  const toasts = useToasts()
  const loadedAt = useRef(0)
  const today = todayISO()
  const readOnly = !!connectionReadOnly

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    try {
      const next = await store.load()
      setData(next)
      setLoadError(null)
      loadedAt.current = Date.now()
    } catch (e) {
      if (quiet) toasts.push(errorText(e), { error: true })
      else setLoadError(errorText(e))
    } finally {
      setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store])

  useEffect(() => { void load() }, [load])

  useEffect(() => {
    const onHash = () => setView(viewFromHash())
    const onVisible = () => { if (document.visibilityState === 'visible' && loadedAt.current && Date.now() - loadedAt.current > 90_000 && !busy) void load(true) }
    window.addEventListener('hashchange', onHash)
    document.addEventListener('visibilitychange', onVisible)
    return () => { window.removeEventListener('hashchange', onHash); document.removeEventListener('visibilitychange', onVisible) }
  }, [load, busy])

  const byId = useMemo(() => resultsById(data?.results ?? []), [data])
  const brands = useMemo(() => (data ? allBrands(data.lists) : []), [data])
  const effectiveFilters = useMemo<Filters>(() => {
    const on = brands.filter((b) => !brandsOff.includes(b))
    return { ...filters, brands: brandsOff.length ? (on.length ? on : ['∅']) : [] }
  }, [filters, brandsOff, brands])

  const statusOf = useCallback((a: Activity) => effectiveStatus(a, (byId.get(a.id) ?? []).length > 0, today), [byId, today])
  const visible = useMemo(() => (data ? applyFilters(data.activities, effectiveFilters, data.lists, byId, today) : []), [data, effectiveFilters, byId, today])
  const suggestionList = useMemo(() => {
    if (!data) return []
    const activities = data.activities.filter((a) => norm(a.status) !== norm(STATUS.deleted))
    return buildSuggestions({ activities, byId, calendar: data.calendar, competitors: data.competitors, monthly: data.monthly, lists: data.lists, today }, data.decisions)
  }, [data, byId, today])

  /** Runs a change in the sheet, then reads everything again so the page always shows what the sheet holds. */
  const run = async (work: () => Promise<void>, done?: () => void): Promise<boolean> => {
    setBusy(true)
    try {
      await work()
      await load(true)
      done?.()
      return true
    } catch (e) {
      toasts.push(errorText(e), { error: true })
      if (e instanceof SheetError && (e.code === 'row_gone' || e.code === 'columns_moved')) void load(true)
      return false
    } finally {
      setBusy(false)
    }
  }

  const go: Ctx['go'] = (next, opts) => {
    if (opts?.year != null) {
      if (next === 'kalendar') setCal((c) => ({ ...c, year: opts.year!, month: opts.month ?? c.month }))
      if (next === 'rocni-prehled') setYearlyYear(opts.year)
      if (next === 'vyhodnoceni') setEvalYear(opts.year)
    }
    if (opts?.date) setCal((c) => ({ ...c, date: opts.date!, year: yearOf(opts.date!), month: monthOf(opts.date!) }))
    setView(next)
    try { location.hash = `#${next}` } catch { /* the hash is a convenience */ }
  }

  const owner = (): string => {
    const people = data?.lists.people ?? []
    if (who && people.some((p) => norm(p) === norm(who))) return people.find((p) => norm(p) === norm(who))!
    const saved = remember('owner')
    return saved && people.includes(saved) ? saved : people[0] ?? ''
  }

  const showInCalendar = (date: ISODate) => ({ label: 'Zobrazit v kalendáři', run: () => go('kalendar', { date }) })

  const decide: Ctx['decide'] = (key, decision, extra) => {
    void run(() => store.decide({ key, decision, reason: extra?.reason ?? '', until: extra?.until ?? '', activityId: extra?.activityId ?? '' }),
      () => toasts.push(decision === 'Odloženo' ? 'Odloženo o 2 týdny.' : decision === 'Zamítnuto' ? 'Zamítnuto, znovu se nabídne jen při změně situace.' : 'Zapsáno.'))
  }

  const duplicate: Ctx['duplicate'] = (ids, to, suggestionKey) => {
    if (!data) return
    const sources = data.activities.filter((a) => ids.includes(a.id))
    if (!sources.length) return
    const inputs: ActivityInput[] = sources.map((a) => {
      const year = 'year' in to ? to.year : yearOf(a.from) + to.shift
      const dates = shiftToYear(a, data.calendar, year)
      const fromYear = String(yearOf(a.from))
      return {
        name: a.name.replace(fromYear, String(yearOf(dates.from))), from: dates.from, to: dates.to, markets: a.markets, channel: a.channel, owner: a.owner,
        status: STATUS.idea, type: a.type, theme: a.theme.replace(fromYear, String(yearOf(dates.from))), mechanics: a.mechanics, code: a.code, budget: a.budget,
        note: a.note, links: { ...a.links, graphics: '', basecamp: '' }, source: `kopie aktivity ${a.id}`,
      }
    })
    void run(async () => {
      const created = await store.createActivities(inputs)
      if (suggestionKey) await store.decide({ key: suggestionKey, decision: 'Přijato', reason: '', until: '', activityId: created[0] })
    }, () => {
      const first = inputs.map((i) => i.from).sort()[0]
      toasts.push(`Založeno ${inputs.length} ${plural(inputs.length, 'aktivita', 'aktivity', 'aktivit')} ve stavu Nápad (${yearOf(first)}). Grafika a Basecamp se nekopírují.`, { action: showInCalendar(first) })
      setDialog(null)
    })
  }

  const saveActivities = (inputs: ActivityInput[], editingId: string | null, suggestionKey?: string) => {
    void run(async () => {
      if (editingId) await store.updateActivity(editingId, inputs[0])
      else {
        const ids = await store.createActivities(inputs)
        if (suggestionKey) await store.decide({ key: suggestionKey, decision: 'Přijato', reason: '', until: '', activityId: ids[0] })
      }
      remember('owner', inputs[0].owner)
    }, () => {
      const first = inputs.map((i) => i.from).sort()[0]
      toasts.push(editingId ? 'Změny uloženy.' : `Založeno ${inputs.length} ${plural(inputs.length, 'aktivita', 'aktivity', 'aktivit')}.`, editingId ? {} : { action: showInCalendar(first) })
      setDialog(null)
    })
  }

  const saveResults = (rows: { activity: Activity; input: ResultInput }[]) => {
    void run(async () => { for (const r of rows) await store.saveResult(r.activity, r.input) },
      () => { toasts.push(rows.length === 1 ? 'Výsledek uložen, aktivita je vyhodnocená.' : `Uloženo ${rows.length} výsledků.`); setDialog(null) })
  }

  const ctx: Ctx | null = data && {
    data, today, byId, visible, filters: effectiveFilters, statusOf, readOnly, busy, competitors: data.competitors,
    openActivity: (id) => setDialog({ kind: 'activity', id }),
    newActivity: (prefill, suggestionKey) => { if (!readOnly) setDialog({ kind: 'new', prefill: prefill ?? {}, suggestionKey }) },
    evaluate: (ids) => {
      const acts = data.activities.filter((a) => ids.includes(a.id))
      if (acts.length === 1) { setDialog({ kind: 'result', id: acts[0].id }); return }
      const ended = acts.filter((a) => a.to < today)
      if (!ended.length) { toasts.push('Žádná z vybraných aktivit ještě neskončila, nemá co vyhodnocovat.', { error: true }); return }
      if (ended.length < acts.length) toasts.push(`${acts.length - ended.length} ještě neskončilo, proto v hromadném vyhodnocení nejsou.`)
      setDialog({ kind: 'bulk', ids: ended.map((a) => a.id) })
    },
    duplicate,
    remove: (ids) => setDialog({ kind: 'remove', ids }),
    newCompetitor: (date) => { if (!readOnly) setDialog({ kind: 'rival', date: date ?? today }) },
    go, decide,
    saveFile: saveFile ? (filename, content) => { saveFile(filename, content).catch((e: { code?: string }) => { if (e?.code !== 'declined') toasts.push('Soubor se nepodařilo uložit. Zkus to znovu.', { error: true }) }) } : undefined,
  }

  const toggleIn = <K extends 'groups' | 'statuses'>(key: K, value: string) =>
    setFilters((f) => ({ ...f, [key]: f[key].includes(value) ? f[key].filter((x) => x !== value) : [...f[key], value] }))

  const active = filtersActive(effectiveFilters)
  const filterCount = brandsOff.length + filters.groups.length + filters.statuses.length
  const activityDialog = dialog && ctx && data && (dialog.kind === 'activity' || dialog.kind === 'result') ? data.activities.find((a) => a.id === dialog.id) : undefined

  return (
    <div id="shell">
      <header className="top">
        <h1>Marketingový plán</h1>
        <nav className="tabs" aria-label="Pohledy">
          {VIEWS.map(([v, label]) => (
            <button key={v} type="button" className="tab" aria-current={view === v ? 'page' : undefined} onClick={() => go(v)}>
              {label}{v === 'doporuceni' && suggestionList.length > 0 && <span className="badge" aria-label={`${suggestionList.length} nových`}>{suggestionList.length}</span>}
            </button>
          ))}
        </nav>
        <div className="top-actions">
          <button type="button" className="btn quiet" disabled={loading || busy} onClick={() => void load(true)} title="Načíst znovu z tabulky">{loading ? 'Načítám…' : '↻ Obnovit'}</button>
          <button type="button" className="btn primary" disabled={!ctx || readOnly} onClick={() => ctx?.newActivity({ from: today, to: today })}>+ Nová aktivita</button>
        </div>
      </header>

      {demo && <div className="notice warn"><span className="grow"><b>Ukázková data.</b> Stránka teď není propojená s tvými Google Tabulkami, proto vidíš příklady. Změny, které uděláš, zmizí po zavření okna. Otevři stránku přímo v Claude, tam se čte a zapisuje do tabulky „Marketingový plán – data“.</span></div>}
      {readOnly && !demo && <div className="notice warn"><span className="grow"><b>Jen pro čtení.</b> Tvoje propojení s Google Tabulkami v Claude neumí zapisovat, proto je ukládání vypnuté.</span></div>}
      {data?.warnings.map((w) => <div key={w} className="notice warn"><span className="grow">{w}</span></div>)}
      {loadError && (
        <div className="notice error" role="alert">
          <span className="grow">{loadError}</span>
          <button type="button" className="btn" onClick={() => void load()}>Zkusit znovu</button>
        </div>
      )}

      {!data && loading && <p className="muted" role="status">Načítám data z tabulky. Claude se při prvním načtení zeptá, jestli stránce povolíš přístup ke Google Tabulkám.</p>}

      {ctx && data && (
        <>
          <div className={`filters${filtersOpen ? ' open' : ''}`} role="search">
            <button type="button" className="btn filters-toggle" aria-expanded={filtersOpen} onClick={() => setFiltersOpen((o) => !o)}>
              Filtry{filterCount > 0 ? ` (${filterCount})` : ''} {filtersOpen ? '▴' : '▾'}
            </button>
            <div className="chipset">
              <span className="label">Značky</span>
              {brands.map((b) => (
                <button key={b} type="button" className="chip brand" aria-pressed={!brandsOff.includes(b)} title={brandsOff.includes(b) ? 'Zapnout značku' : 'Vypnout značku'}
                  onClick={() => setBrandsOff((off) => (off.includes(b) ? off.filter((x) => x !== b) : [...off, b]))}>
                  <span className="dot" style={{ background: vivid(brandColor(data.lists, b)) }} />{b}
                </button>
              ))}
            </div>
            <div className="chipset">
              <span className="label">Kanál</span>
              {channelGroups(data.lists).map((g) => <button key={g} type="button" className="chip" aria-pressed={filters.groups.includes(g)} onClick={() => toggleIn('groups', g)}>{g}</button>)}
            </div>
            <div className="chipset">
              <span className="label">Stav</span>
              {[...STATUS_FLOW, STATUS.cancelled].map((s) => <button key={s} type="button" className="chip" aria-pressed={filters.statuses.includes(s)} onClick={() => toggleIn('statuses', s)}>{s}</button>)}
            </div>
            <input className="search" type="search" aria-label="Hledat" placeholder="Hledat v názvu, tématu, kódu…" value={filters.search} onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))} />
            {(active || brandsOff.length > 0) && <button type="button" className="btn quiet small" onClick={() => { setFilters(noFilters()); setBrandsOff([]) }}>Zrušit filtry</button>}
          </div>

          {view === 'kalendar' && <CalendarView ctx={ctx} state={cal} setState={setCal} />}
          {view === 'seznam' && <ListView ctx={ctx} />}
          {view === 'vyhodnoceni' && <EvaluationView ctx={ctx} year={evalYear} setYear={setEvalYear} />}
          {view === 'rocni-prehled' && <YearlyView ctx={ctx} year={yearlyYear} setYear={setYearlyYear} />}
          {view === 'doporuceni' && <RecommendView ctx={ctx} items={suggestionList} />}
          {view === 'konkurence' && <CompetitorsView ctx={ctx} />}
        </>
      )}

      {ctx && data && dialog?.kind === 'new' && (
        <ActivityDrawer key="new" lists={data.lists} mode="create" initial={dialog.prefill} owner={owner()} results={[]} busy={busy} readOnly={readOnly}
          onClose={() => setDialog(null)} onSave={(inputs) => saveActivities(inputs, null, dialog.suggestionKey)} />
      )}
      {ctx && data && dialog?.kind === 'activity' && activityDialog && (
        <ActivityDrawer key={activityDialog.id} lists={data.lists} mode="edit" initial={activityDialog} activity={activityDialog} owner={owner()} results={byId.get(activityDialog.id) ?? []}
          status={statusOf(activityDialog)} busy={busy} readOnly={readOnly} onClose={() => setDialog(null)} onSave={(inputs) => saveActivities(inputs, activityDialog.id)}
          onDuplicate={() => duplicate([activityDialog.id], { shift: 1 })} onDelete={() => setDialog({ kind: 'remove', ids: [activityDialog.id] })}
          onEvaluate={() => setDialog({ kind: 'result', id: activityDialog.id })} />
      )}
      {ctx && data && dialog?.kind === 'result' && activityDialog && (
        <ResultDialog key={activityDialog.id} activity={activityDialog} lists={data.lists} existing={byId.get(activityDialog.id)?.[0]} busy={busy} readOnly={readOnly}
          onClose={() => setDialog(null)} onSave={(input) => saveResults([{ activity: activityDialog, input }])} />
      )}
      {ctx && data && dialog?.kind === 'bulk' && (
        <BulkEvaluate activities={data.activities.filter((a) => dialog.ids.includes(a.id))} lists={data.lists} existing={byId} busy={busy} readOnly={readOnly}
          onClose={() => setDialog(null)} onSave={saveResults} />
      )}
      {ctx && data && dialog?.kind === 'rival' && (
        <CompetitorForm lists={data.lists} busy={busy} readOnly={readOnly} defaultDate={dialog.date} onClose={() => setDialog(null)}
          onSave={(c: CompetitorInput) => void run(() => store.addCompetitorAction(c), () => { toasts.push('Akce konkurence zapsána.'); setDialog(null) })} />
      )}
      {ctx && data && dialog?.kind === 'remove' && (
        <Confirm title={dialog.ids.length === 1 ? 'Smazat tuhle aktivitu?' : `Smazat ${dialog.ids.length} ${plural(dialog.ids.length, 'aktivitu', 'aktivity', 'aktivit')}?`} confirmLabel="Ano, smazat" busy={busy}
          onCancel={() => setDialog(null)}
          onConfirm={() => void run(() => store.remove(dialog.ids), () => { toasts.push(`Smazáno: ${dialog.ids.length}. V tabulce zůstává řádek se stavem Smazáno.`); setDialog(null) })}>
          {dialog.ids.length === 1 ? `„${data.activities.find((a) => a.id === dialog.ids[0])?.name ?? ''}“ zmizí z kalendáře a seznamu.` : 'Zmizí z kalendáře a seznamu.'} V tabulce zůstane řádek se stavem Smazáno, kdyby šlo něco vrátit.
        </Confirm>
      )}
      <Toasts items={toasts.items} dismiss={toasts.dismiss} />
    </div>
  )
}

export { addDays, formatDate }
