import React, { useMemo, useState } from 'react'
import { formatDate, isISODate, type ISODate } from '../lib/dates'
import {
  channelByName, emptyLinks, LINK_LABELS, STATUS, type Activity, type ActivityInput, type CompetitorInput, type Lists, type Links, type Result, type ResultField, type ResultInput,
} from '../lib/model'
import { count, money, norm, parseNumber, percent, signedMoney } from '../lib/parse'
import { activityMargin, mktProfit, suggestGrossProfit, totals } from '../lib/stats'
import { ChannelPicker, MarketPicker, Stars, StatusPill, useEscape } from './common'

const field = (v: number | null | undefined): string => (v == null ? '' : String(v).replace('.', ','))

interface ActivityDraft {
  name: string; from: string; to: string; markets: string[]; channels: string[]; owner: string; status: string; type: string; theme: string
  mechanics: string; code: string; budget: string; note: string; links: Links; source: string
}

export function draftFrom(a: Partial<ActivityInput>, lists: Lists, owner: string): ActivityDraft {
  return {
    name: a.name ?? '', from: a.from ?? '', to: a.to && a.to !== a.from ? a.to : '', markets: a.markets ?? [], channels: a.channel ? [a.channel] : [],
    owner: a.owner || owner || lists.people[0] || '', status: a.status || STATUS.idea, type: a.type ?? '', theme: a.theme ?? '', mechanics: a.mechanics ?? '',
    code: a.code ?? '', budget: field(a.budget), note: a.note ?? '', links: a.links ?? emptyLinks(), source: a.source ?? '',
  }
}

/** Channels the activity was drawn up for; an edit keeps exactly one. */
export function inputsFromDraft(d: ActivityDraft): ActivityInput[] {
  const several = d.channels.length > 1
  return d.channels.map((channel) => ({
    name: several ? `${d.name.trim()} – ${channel}` : d.name.trim(),
    from: d.from, to: d.to || d.from, markets: d.markets, channel, owner: d.owner, status: d.status, type: d.type,
    theme: d.theme.trim() || (several ? d.name.trim() : ''), mechanics: d.mechanics.trim(), code: d.code.trim(), budget: parseNumber(d.budget),
    note: d.note.trim(), links: d.links, source: d.source,
  }))
}

function validate(d: ActivityDraft): Record<string, string> {
  const e: Record<string, string> = {}
  if (!d.name.trim()) e.name = 'Doplň název.'
  if (!isISODate(d.from)) e.from = 'Vyber datum začátku.'
  if (d.to && isISODate(d.from) && d.to < d.from) e.to = 'Konec nemůže být před začátkem.'
  if (!d.markets.length) e.markets = 'Vyber aspoň jednu značku a zemi.'
  if (!d.channels.length) e.channels = 'Vyber kanál.'
  if (!d.owner) e.owner = 'Vyber odpovědnou osobu.'
  if (d.budget.trim() && parseNumber(d.budget) == null) e.budget = 'Rozpočet musí být číslo.'
  return e
}

export interface DrawerProps {
  lists: Lists
  mode: 'create' | 'edit'
  initial: Partial<ActivityInput>
  owner: string
  activity?: Activity
  results: Result[]
  status?: string
  busy: boolean
  readOnly: boolean
  onSave: (inputs: ActivityInput[]) => void
  onClose: () => void
  onDuplicate?: () => void
  onDelete?: () => void
  onEvaluate?: () => void
}

export function ActivityDrawer(p: DrawerProps) {
  const [d, setD] = useState(() => draftFrom(p.initial, p.lists, p.owner))
  const [touched, setTouched] = useState(false)
  useEscape(p.onClose)
  const errors = useMemo(() => validate(d), [d])
  const set = <K extends keyof ActivityDraft>(k: K, v: ActivityDraft[K]) => setD((x) => ({ ...x, [k]: v }))
  const editing = p.mode === 'edit'
  const created = !editing && d.channels.length > 1 ? d.channels.length : 0
  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length) return
    p.onSave(inputsFromDraft(d))
  }
  const show = (k: string) => (touched ? errors[k] : undefined)
  const t = totals(p.results)

  return (
    <div className="scrim" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) p.onClose() }}>
      <form className="drawer" onSubmit={submit} noValidate aria-label={editing ? 'Upravit aktivitu' : 'Nová aktivita'}>
        <header>
          <h2>{editing ? 'Aktivita' : 'Nová aktivita'}</h2>
          {editing && p.status && <StatusPill status={p.status} />}
          <button type="button" className="icon-btn" aria-label="Zavřít" onClick={p.onClose}>✕</button>
        </header>
        <div className="body">
          <label className="field">
            <span>Název <b className="req">*</b></span>
            <input id="f-name" type="text" value={d.name} autoFocus={!editing} onChange={(e) => set('name', e.target.value)} placeholder="Například SMS Black Friday" />
            {show('name') && <span className="err">{show('name')}</span>}
          </label>
          <div className="grid2">
            <label className="field">
              <span>Datum od <b className="req">*</b></span>
              <input id="f-from" type="date" value={d.from} onChange={(e) => set('from', e.target.value)} />
              {show('from') && <span className="err">{show('from')}</span>}
            </label>
            <label className="field">
              <span>Datum do</span>
              <input id="f-to" type="date" value={d.to} min={d.from || undefined} onChange={(e) => set('to', e.target.value)} />
              {show('to') ? <span className="err">{show('to')}</span> : <span className="hint">Prázdné = jednodenní.</span>}
            </label>
          </div>
          <div className="stack">
            <span className="field-label">Značka a země <b className="req">*</b></span>
            <MarketPicker lists={p.lists} value={d.markets} onChange={(v) => set('markets', v)} />
            {show('markets') && <span className="err">{show('markets')}</span>}
          </div>
          <div className="stack">
            <span className="field-label">Kanál <b className="req">*</b>{!editing && <span className="hint"> (jde vybrat víc, každý bude samostatná aktivita)</span>}</span>
            <ChannelPicker lists={p.lists} value={d.channels} onChange={(v) => set('channels', v)} multiple={!editing} />
            {show('channels') && <span className="err">{show('channels')}</span>}
            {created > 0 && <span className="hint">Vznikne {created} aktivit se stejným tématem: {inputsFromDraft(d).map((i) => i.channel).join(', ')}.</span>}
          </div>
          <label className="field">
            <span>Odpovědný <b className="req">*</b></span>
            <select id="f-owner" value={d.owner} onChange={(e) => set('owner', e.target.value)}>
              {!p.lists.people.includes(d.owner) && <option value={d.owner}>{d.owner || 'Vyber…'}</option>}
              {p.lists.people.map((x) => <option key={x}>{x}</option>)}
            </select>
            {show('owner') && <span className="err">{show('owner')}</span>}
          </label>

          <details className="more" open={editing}>
            <summary>Další údaje</summary>
            <div className="stack" style={{ marginTop: 10 }}>
              <div className="grid2">
                <label className="field"><span>Stav</span>
                  <select id="f-status" value={d.status} onChange={(e) => set('status', e.target.value)}>
                    {[STATUS.idea, STATUS.prep, STATUS.approved, STATUS.cancelled].map((s) => <option key={s}>{s}</option>)}
                    {![STATUS.idea, STATUS.prep, STATUS.approved, STATUS.cancelled].includes(d.status as typeof STATUS.idea) && <option>{d.status}</option>}
                  </select>
                  <span className="hint">Běží, Hotovo a Vyhodnoceno se nastaví samo podle dat a výsledku.</span>
                </label>
                <label className="field"><span>Typ</span>
                  <select id="f-type" value={d.type} onChange={(e) => set('type', e.target.value)}>
                    <option value="">–</option>
                    {p.lists.types.map((x) => <option key={x}>{x}</option>)}
                    {d.type && !p.lists.types.includes(d.type) && <option>{d.type}</option>}
                  </select>
                </label>
              </div>
              <label className="field"><span>Téma nebo produkt</span><input id="f-theme" type="text" value={d.theme} onChange={(e) => set('theme', e.target.value)} placeholder="Podle něj se aktivity sdružují, třeba Black Friday" /></label>
              <div className="grid2">
                <label className="field"><span>Sleva / mechanika</span><input id="f-mech" type="text" value={d.mechanics} onChange={(e) => set('mechanics', e.target.value)} /></label>
                <label className="field"><span>Slevový kód</span><input id="f-code" type="text" value={d.code} onChange={(e) => set('code', e.target.value)} /></label>
              </div>
              <label className="field"><span>Rozpočet (Kč)</span><input id="f-budget" type="text" inputMode="decimal" value={d.budget} onChange={(e) => set('budget', e.target.value)} />{show('budget') && <span className="err">{show('budget')}</span>}</label>
              <label className="field"><span>Popis</span><textarea id="f-note" value={d.note} onChange={(e) => set('note', e.target.value)} /></label>
              <div className="grid2">
                {(Object.keys(LINK_LABELS) as (keyof Links)[]).map((k) => (
                  <label className="field" key={k}><span>Odkaz: {LINK_LABELS[k]}</span><input id={`f-link-${k}`} type="url" inputMode="url" value={d.links[k]} onChange={(e) => set('links', { ...d.links, [k]: e.target.value })} placeholder="https://" /></label>
                ))}
              </div>
              {d.source && <span className="hint">Zdroj záznamu: {d.source}</span>}
            </div>
          </details>

          {editing && p.activity && (
            <div className="panel">
              <div className="head"><h2>Výsledek</h2><span className="grow" />{!p.readOnly && <button type="button" className="btn small" onClick={p.onEvaluate}>{p.results.length ? 'Upravit výsledek' : 'Vyplnit výsledek'}</button>}</div>
              {p.results.length ? (
                <div className="stack num">
                  <div className="row" style={{ gap: 18 }}>
                    {t.cost != null && <span>Náklad <b>{money(t.cost)}</b></span>}
                    {t.revenue != null && <span>Tržby <b>{money(t.revenue)}</b></span>}
                    {t.orders != null && <span>Objednávky <b>{count(t.orders)}</b></span>}
                    {t.profit != null && <span>MKT profit 1 <b className={t.profit < 0 ? 'loss' : 'gain'}>{signedMoney(t.profit)}</b></span>}
                    <Stars value={t.rating} />
                  </div>
                  {t.lesson && <span className="muted">Co příště jinak: {t.lesson}</span>}
                </div>
              ) : <span className="muted">Zatím bez výsledku.</span>}
            </div>
          )}
        </div>
        <footer>
          <button type="submit" className="btn primary" disabled={p.busy || p.readOnly}>{p.busy ? 'Ukládám…' : editing ? 'Uložit změny' : created ? `Založit ${created} aktivit` : 'Založit aktivitu'}</button>
          <button type="button" className="btn" onClick={p.onClose}>Zavřít</button>
          {editing && p.onDuplicate && <button type="button" className="btn" disabled={p.busy || p.readOnly} onClick={p.onDuplicate}>Duplikovat o rok</button>}
          {editing && p.onDelete && <button type="button" className="btn danger" style={{ marginLeft: 'auto' }} disabled={p.busy || p.readOnly} onClick={p.onDelete}>Smazat…</button>}
          {p.readOnly && <span className="hint" style={{ alignSelf: 'center' }}>Ukázková data se neukládají.</span>}
        </footer>
      </form>
    </div>
  )
}

/* ---------- result ---------- */

const LABEL: Record<ResultField, string> = {
  cost: 'Skutečný náklad (Kč)', revenue: 'Tržby (Kč)', orders: 'Počet objednávek', visits: 'Návštěvy', sent: 'Odesláno', openRate: 'Open rate (%)', ctr: 'CTR (%)',
}

/** Fields of a channel in the order people read them. */
const FIELD_ORDER: ResultField[] = ['sent', 'openRate', 'ctr', 'cost', 'revenue', 'orders', 'visits']

export const fieldsOf = (lists: Lists, channel: string): ResultField[] => {
  const fields = channelByName(lists, channel)?.fields ?? ['cost', 'revenue', 'orders', 'visits']
  return FIELD_ORDER.filter((f) => fields.includes(f) || f === 'cost')
}

interface ResultDraft {
  cost: string; revenue: string; orders: string; visits: string; sent: string; openRate: string; ctr: string
  grossProfit: string; grossManual: boolean; rating: number | null; lesson: string; numbersSource: string
}

const resultDraft = (r: Result | undefined): ResultDraft => ({
  cost: field(r?.cost), revenue: field(r?.revenue), orders: field(r?.orders), visits: field(r?.visits), sent: field(r?.sent), openRate: field(r?.openRate), ctr: field(r?.ctr),
  grossProfit: field(r?.grossProfit), grossManual: r?.grossProfit != null, rating: r?.rating ?? null, lesson: r?.lesson ?? '', numbersSource: r?.numbersSource ?? '',
})

const NOTE_FROM_MARGIN = 'hrubý zisk dopočten z marže trhu'

function toInput(d: ResultDraft, activity: Activity, margin: number | null): ResultInput {
  const revenue = parseNumber(d.revenue)
  const gp = d.grossManual ? parseNumber(d.grossProfit) : suggestGrossProfit(revenue, margin)
  let source = d.numbersSource.trim()
  if (!d.grossManual && gp != null && !source) source = NOTE_FROM_MARGIN
  return {
    activityId: activity.id, market: '', cost: parseNumber(d.cost), revenue, orders: parseNumber(d.orders), visits: parseNumber(d.visits), sent: parseNumber(d.sent),
    openRate: parseNumber(d.openRate), ctr: parseNumber(d.ctr), grossProfit: gp, rating: d.rating, lesson: d.lesson.trim(), numbersSource: source,
  }
}

const hasAnything = (r: ResultInput): boolean =>
  [r.cost, r.revenue, r.orders, r.visits, r.sent, r.openRate, r.ctr, r.grossProfit, r.rating].some((v) => v != null) || r.lesson !== ''

function NumberInput({ id, value, onChange, label, suffix }: { id: string; value: string; onChange: (v: string) => void; label: string; suffix?: string }) {
  const bad = value.trim() !== '' && parseNumber(value) == null
  return (
    <label className="field">
      <span>{label}</span>
      <input id={id} type="text" inputMode="decimal" value={value} onChange={(e) => onChange(e.target.value)} aria-invalid={bad} />
      {bad ? <span className="err">Napiš číslo.</span> : suffix ? <span className="hint">{suffix}</span> : null}
    </label>
  )
}

export function ResultDialog({ activity, lists, existing, busy, readOnly, onSave, onClose }: {
  activity: Activity; lists: Lists; existing: Result | undefined; busy: boolean; readOnly: boolean; onSave: (r: ResultInput) => void; onClose: () => void
}) {
  const [d, setD] = useState(() => resultDraft(existing))
  useEscape(onClose)
  const fields = fieldsOf(lists, activity.channel)
  const margin = activityMargin(activity.markets, lists)
  const revenue = parseNumber(d.revenue)
  const showProfit = fields.includes('revenue')
  const gross = d.grossManual ? parseNumber(d.grossProfit) : suggestGrossProfit(revenue, margin)
  const profit = showProfit ? mktProfit(gross, parseNumber(d.cost)) : null
  const set = <K extends keyof ResultDraft>(k: K, v: ResultDraft[K]) => setD((x) => ({ ...x, [k]: v }))
  const invalid = fields.some((f) => d[f].trim() !== '' && parseNumber(d[f]) == null) || (d.grossManual && d.grossProfit.trim() !== '' && parseNumber(d.grossProfit) == null)
  const input = toInput(d, activity, margin)

  return (
    <div className="scrim center" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="dialog" style={{ width: 'min(560px, 100%)' }} noValidate aria-label="Výsledek aktivity" onSubmit={(e) => { e.preventDefault(); if (!invalid) onSave(input) }}>
        <div>
          <h2>Výsledek</h2>
          <div className="muted">{activity.name} · {formatDate(activity.from)}</div>
        </div>
        <div className="grid2">
          {fields.map((f) => <NumberInput key={f} id={`r-${f}`} label={LABEL[f]} value={d[f]} onChange={(v) => set(f, v)} />)}
        </div>
        {showProfit && (
          <div className="grid2">
            <label className="field">
              <span>Hrubý zisk (Kč)</span>
              <input id="r-gross" type="text" inputMode="decimal" aria-label="Hrubý zisk" value={d.grossManual ? d.grossProfit : field(gross)}
                onChange={(e) => setD((x) => ({ ...x, grossProfit: e.target.value, grossManual: true }))} placeholder={margin == null ? 'Marže trhu není vyplněná' : ''} />
              <span className="hint">{d.grossManual ? 'Zadáno ručně.' : margin != null ? `Dopočteno: tržby × marže ${percent(margin)}. Jde přepsat.` : 'U tohoto trhu není v číselníku marže, doplň hrubý zisk ručně.'}</span>
            </label>
            <div className="field"><span className="field-label">MKT profit 1 (Kč)</span>
              <div className="num" style={{ padding: '7px 0', fontWeight: 700 }} aria-live="polite">{profit == null ? <span className="faint">dopočítá se z hrubého zisku</span> : <span className={profit < 0 ? 'loss' : 'gain'}>{signedMoney(profit) || '0 Kč'}</span>}</div>
              <span className="hint">Hrubý zisk − náklad.</span>
            </div>
          </div>
        )}
        <div className="field"><span className="field-label">Hodnocení</span><Stars value={d.rating} onChange={(v) => set('rating', v)} /></div>
        <label className="field"><span>Co příště jinak (jedna věta)</span><input id="r-lesson" type="text" value={d.lesson} onChange={(e) => set('lesson', e.target.value)} /></label>
        <label className="field"><span>Odkud jsou čísla</span><input id="r-source" type="text" value={d.numbersSource} onChange={(e) => set('numbersSource', e.target.value)} placeholder="Třeba Power BI, Targito, faktura" /></label>
        <div className="row end">
          {readOnly && <span className="hint">Ukázková data se neukládají.</span>}
          <button type="button" className="btn" onClick={onClose}>Zrušit</button>
          <button type="submit" className="btn primary" disabled={busy || readOnly || invalid || !hasAnything(input)}>{busy ? 'Ukládám…' : 'Uložit výsledek'}</button>
        </div>
      </form>
    </div>
  )
}

/* ---------- bulk evaluation ---------- */

export function BulkEvaluate({ activities, lists, existing, busy, readOnly, onSave, onClose }: {
  activities: Activity[]; lists: Lists; existing: Map<string, Result[]>; busy: boolean; readOnly: boolean; onSave: (rows: { activity: Activity; input: ResultInput }[]) => void; onClose: () => void
}) {
  const [drafts, setDrafts] = useState<Record<string, ResultDraft>>(() => Object.fromEntries(activities.map((a) => [a.id, resultDraft(existing.get(a.id)?.[0])])))
  useEscape(onClose)
  const columns = FIELD_ORDER.filter((f) => activities.some((a) => fieldsOf(lists, a.channel).includes(f)))
  const patch = (id: string, p: Partial<ResultDraft>) => setDrafts((x) => ({ ...x, [id]: { ...x[id], ...p } }))
  const rows = activities.map((activity) => ({ activity, input: toInput(drafts[activity.id], activity, activityMargin(activity.markets, lists)) }))
  const filled = rows.filter((r) => hasAnything(r.input))
  const bad = activities.some((a) => fieldsOf(lists, a.channel).some((f) => drafts[a.id][f].trim() !== '' && parseNumber(drafts[a.id][f]) == null))

  return (
    <div className="scrim center" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="dialog wide" noValidate aria-label="Hromadné vyhodnocení" onSubmit={(e) => { e.preventDefault(); if (!bad && filled.length) onSave(filled) }}>
        <div>
          <h2>Vyhodnotit {activities.length} {activities.length === 1 ? 'aktivitu' : activities.length < 5 ? 'aktivity' : 'aktivit'}</h2>
          <div className="muted">Vyplň jen to, co víš. Řádky, kde nic nevyplníš, se přeskočí. Hrubý zisk se dopočítá z tržeb a marže trhu.</div>
        </div>
        <div className="scroll-x">
          <table className="t">
            <thead>
              <tr>
                <th>Aktivita</th>
                {columns.map((f) => <th key={f}>{LABEL[f]}</th>)}
                <th>MKT profit 1</th>
                <th>Hodnocení</th>
                <th>Co příště jinak</th>
              </tr>
            </thead>
            <tbody>
              {rows.map(({ activity, input }) => {
                const d = drafts[activity.id]
                const ok = fieldsOf(lists, activity.channel)
                const profit = ok.includes('revenue') ? mktProfit(input.grossProfit, input.cost) : null
                return (
                  <tr key={activity.id}>
                    <td style={{ minWidth: 200 }}><b>{activity.name}</b><div className="faint">{activity.channel} · {formatDate(activity.from, false)}</div></td>
                    {columns.map((f) => (
                      <td key={f} style={{ minWidth: 104 }}>
                        {ok.includes(f)
                          ? <input type="text" inputMode="decimal" aria-label={`${LABEL[f]}, ${activity.name}`} value={d[f]} aria-invalid={d[f].trim() !== '' && parseNumber(d[f]) == null} onChange={(e) => patch(activity.id, { [f]: e.target.value })} />
                          : <span className="faint">–</span>}
                      </td>
                    ))}
                    <td className="num" style={{ minWidth: 110 }}>{profit == null ? '' : <span className={profit < 0 ? 'loss' : 'gain'}>{signedMoney(profit)}</span>}</td>
                    <td><Stars value={d.rating} onChange={(v) => patch(activity.id, { rating: v })} /></td>
                    <td style={{ minWidth: 200 }}><input type="text" aria-label={`Co příště jinak, ${activity.name}`} value={d.lesson} onChange={(e) => patch(activity.id, { lesson: e.target.value })} /></td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        <div className="row end">
          {readOnly && <span className="hint">Ukázková data se neukládají.</span>}
          <span className="muted">Uloží se {filled.length} z {activities.length}.</span>
          <button type="button" className="btn" onClick={onClose}>Zrušit</button>
          <button type="submit" className="btn primary" disabled={busy || readOnly || bad || !filled.length}>{busy ? 'Ukládám…' : 'Uložit výsledky'}</button>
        </div>
      </form>
    </div>
  )
}

/* ---------- competitor action ---------- */

export function CompetitorForm({ lists, busy, readOnly, defaultDate, onSave, onClose }: { lists: Lists; busy: boolean; readOnly: boolean; defaultDate: ISODate; onSave: (c: CompetitorInput) => void; onClose: () => void }) {
  const watched = lists.competitors.filter((c) => c.watch)
  const [d, setD] = useState({ competitor: watched[0]?.name ?? '', from: defaultDate, to: '', channel: '', what: '', mechanics: '', link: '', confidence: 'střední' })
  const [touched, setTouched] = useState(false)
  useEscape(onClose)
  const set = (k: keyof typeof d, v: string) => setD((x) => ({ ...x, [k]: v }))
  const errors: Record<string, string> = {}
  if (!d.competitor.trim()) errors.competitor = 'Vyber nebo napiš konkurenta.'
  if (!isISODate(d.from)) errors.from = 'Vyber datum.'
  if (!d.what.trim()) errors.what = 'Napiš, co dělali.'
  const known = lists.competitors.find((c) => norm(c.name) === norm(d.competitor))
  const save = (e: React.FormEvent) => {
    e.preventDefault()
    setTouched(true)
    if (Object.keys(errors).length) return
    onSave({ from: d.from, to: d.to || d.from, competitor: d.competitor.trim(), country: known?.country ?? '', channel: d.channel, what: d.what.trim(), mechanics: d.mechanics.trim(), link: d.link.trim(), source: 'ručně', confidence: d.confidence })
  }
  return (
    <div className="scrim center" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onClose() }}>
      <form className="dialog" style={{ width: 'min(560px, 100%)' }} noValidate aria-label="Akce konkurence" onSubmit={save}>
        <h2>Akce konkurence</h2>
        <label className="field"><span>Konkurent <b className="req">*</b></span>
          <input id="k-competitor" type="text" list="k-list" value={d.competitor} onChange={(e) => set('competitor', e.target.value)} />
          <datalist id="k-list">{lists.competitors.map((c) => <option key={c.name} value={c.name}>{c.country}</option>)}</datalist>
          {touched && errors.competitor && <span className="err">{errors.competitor}</span>}
        </label>
        <div className="grid2">
          <label className="field"><span>Datum od <b className="req">*</b></span><input id="k-from" type="date" value={d.from} onChange={(e) => set('from', e.target.value)} />{touched && errors.from && <span className="err">{errors.from}</span>}</label>
          <label className="field"><span>Datum do</span><input id="k-to" type="date" value={d.to} min={d.from} onChange={(e) => set('to', e.target.value)} /></label>
        </div>
        <label className="field"><span>Co dělali <b className="req">*</b></span><input id="k-what" type="text" value={d.what} onChange={(e) => set('what', e.target.value)} placeholder="Třeba výprodej, banner na úvodní stránce, newsletter" />{touched && errors.what && <span className="err">{errors.what}</span>}</label>
        <div className="grid2">
          <label className="field"><span>Kanál</span>
            <select id="k-channel" value={d.channel} onChange={(e) => set('channel', e.target.value)}><option value="">–</option>{lists.channels.map((c) => <option key={c.name}>{c.name}</option>)}</select>
          </label>
          <label className="field"><span>Sleva / mechanika</span><input id="k-mech" type="text" value={d.mechanics} onChange={(e) => set('mechanics', e.target.value)} /></label>
        </div>
        <div className="grid2">
          <label className="field"><span>Odkaz nebo snímek</span><input id="k-link" type="url" inputMode="url" value={d.link} onChange={(e) => set('link', e.target.value)} placeholder="https://" /></label>
          <label className="field"><span>Jistota</span><select id="k-conf" value={d.confidence} onChange={(e) => set('confidence', e.target.value)}><option>vysoká</option><option>střední</option><option>nízká</option></select></label>
        </div>
        <div className="row end">
          {readOnly && <span className="hint">Ukázková data se neukládají.</span>}
          <button type="button" className="btn" onClick={onClose}>Zrušit</button>
          <button type="submit" className="btn primary" disabled={busy || readOnly}>{busy ? 'Ukládám…' : 'Zapsat'}</button>
        </div>
      </form>
    </div>
  )
}
