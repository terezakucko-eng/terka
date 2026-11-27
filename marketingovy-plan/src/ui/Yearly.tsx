import React, { useMemo } from 'react'
import { occurrence, occurrences, themeMatches, type Occurrence } from '../lib/calendar'
import { addDays, formatRange, monthOf, MONTHS, overlaps, yearOf } from '../lib/dates'
import { STATUS, type Activity, type CompetitorAction } from '../lib/model'
import { money, norm, signedMoney } from '../lib/parse'
import { totals } from '../lib/stats'
import { BrandDots, Empty, Stars, StatusPill } from './common'
import { type Ctx } from './ctx'

const isDay = (kind: string): boolean => norm(kind) === 'významný den'

export function YearlyView({ ctx, year, setYear }: { ctx: Ctx; year: number; setYear: (y: number) => void }) {
  const entries = ctx.data.calendar
  const list = useMemo(() => occurrences(entries, year), [entries, year])
  const years = [year - 2, year - 1, year]
  const live = (a: Activity) => ![STATUS.deleted, STATUS.cancelled].includes(a.status as typeof STATUS.deleted)
  const options = useMemo(() => {
    const ys = new Set<number>([yearOf(ctx.today) - 1, yearOf(ctx.today), yearOf(ctx.today) + 1, year, ...ctx.data.activities.map((a) => yearOf(a.from))])
    return [...ys].sort()
  }, [ctx.data.activities, ctx.today, year])

  const byMonth = new Map<number, Occurrence[]>()
  for (const o of list) byMonth.set(monthOf(o.from), [...(byMonth.get(monthOf(o.from)) ?? []), o])

  return (
    <section aria-label="Roční přehled" className="stack" style={{ gap: 14 }}>
      <div className="row">
        <h2 style={{ fontSize: 20 }}>Roční přehled</h2>
        <select aria-label="Rok" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>{options.map((y) => <option key={y}>{y}</option>)}</select>
        <span className="hint">Významné dny, sezóny a akce, které se opakují každý rok. Upravíš je v listu „Roční kalendář“ v tabulce.</span>
      </div>
      {!list.length && <Empty title="Roční kalendář je prázdný">Přidej řádky do listu „Roční kalendář“ v tabulce a načti data znovu.</Empty>}
      {[...byMonth.keys()].sort((a, b) => a - b).map((m) => (
        <div key={m} className="stack" style={{ gap: 8 }}>
          <h3 style={{ fontSize: 15, textTransform: 'capitalize', color: 'var(--muted)' }}>{MONTHS[m]} {year}</h3>
          {byMonth.get(m)!.map((o) => <Theme key={`${o.name}-${o.from}`} ctx={ctx} o={o} years={years} live={live} />)}
        </div>
      ))}
    </section>
  )
}

function Theme({ ctx, o, years, live }: { ctx: Ctx; o: Occurrence; years: number[]; live: (a: Activity) => boolean }) {
  const entry = ctx.data.calendar.find((e) => norm(e.name) === norm(o.name))
  const all = ctx.data.activities.filter((a) => live(a) && themeMatches(a, o.name))
  const perYear = years.map((y) => ({ year: y, items: all.filter((a) => yearOf(a.from) === y) }))
  const previous = perYear.filter((p) => p.year < o.year && p.items.length).slice(-1)[0]
  const thisYear = perYear.find((p) => p.year === o.year)!
  const rivals: CompetitorAction[] = ctx.competitors.filter((r) => {
    if (!entry) return false
    return [o.year - 1, o.year - 2].some((y) => { const oc = occurrence(entry, y); return oc != null && overlaps(r.from, r.to, addDays(oc.from, -14), addDays(oc.to, 7)) })
  })
  const day = o.mainDay ?? (o.from === o.to ? o.from : null)

  return (
    <details className="theme">
      <summary>
        <span className="when">{formatRange(o.from, o.to, false)}</span>
        <span><b>{o.name}</b> <span className={`pill ${isDay(o.kind) ? 'info' : 'accent'}`} style={{ marginLeft: 6 }}>{o.kind}</span>{day && o.mainDay && <span className="faint"> · samotný den {formatRange(day, day, false)}</span>}</span>
        <span className="years">
          {perYear.map((p) => <span key={p.year} className={`pill ${p.year === o.year ? (p.items.length ? 'ok' : o.to >= ctx.today ? 'warn' : 'faint') : 'faint'}`}>{p.year}: {p.items.length || '–'}</span>)}
        </span>
      </summary>
      <div className="detail">
        {o.note && <span className="muted">{o.note}</span>}
        {perYear.filter((p) => p.year < o.year && p.items.length).reverse().map((p) => (
          <div key={p.year} className="scroll-x">
            <div className="field-label" style={{ marginBottom: 4 }}>Rok {p.year}</div>
            <table className="t">
              <thead><tr><th>Datum</th><th>Aktivita</th><th>Značka</th><th>Stav</th><th className="r">Náklad</th><th className="r">MKT profit 1</th><th>Hodnocení</th><th>Co příště jinak</th></tr></thead>
              <tbody>
                {p.items.map((a) => {
                  const t = totals(ctx.byId.get(a.id) ?? [])
                  return (
                    <tr key={a.id}>
                      <td className="num">{formatRange(a.from, a.to, false)}</td>
                      <td><button type="button" className="linklike" onClick={() => ctx.openActivity(a.id)}>{a.name}</button><div className="faint">{a.channel}</div></td>
                      <td><BrandDots lists={ctx.data.lists} markets={a.markets} /></td>
                      <td><StatusPill status={ctx.statusOf(a)} /></td>
                      <td className="r num">{money(t.cost, false)}</td>
                      <td className={`r num ${t.profit != null ? (t.profit < 0 ? 'loss' : 'gain') : ''}`}>{signedMoney(t.profit)}</td>
                      <td><Stars value={t.rating} /></td>
                      <td>{t.lesson}</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        ))}
        {!previous && <span className="muted">Z minulých let k tomuhle tématu v plánu nic není.</span>}
        {thisYear.items.length > 0 && <span className="muted">Letos je naplánováno: {thisYear.items.map((a) => a.name).join(', ')}.</span>}
        {rivals.length > 0 && (
          <div>
            <div className="field-label">Konkurence ve stejných týdnech minulých let</div>
            <ul style={{ margin: '4px 0 0', paddingLeft: 18 }}>{rivals.slice(0, 6).map((r) => <li key={r.id || `${r.competitor}-${r.from}`}>{r.competitor}: {r.what}{r.mechanics ? ` (${r.mechanics})` : ''} <span className="faint">{formatRange(r.from, r.to)}</span></li>)}</ul>
          </div>
        )}
        {!ctx.readOnly && (
          <div className="row">
            {previous && !thisYear.items.length && <button type="button" className="btn primary" disabled={ctx.busy} onClick={() => ctx.duplicate(previous.items.map((a) => a.id), { year: o.year })}>Naplánovat znovu na {o.year} ({previous.items.length})</button>}
            <button type="button" className="btn" onClick={() => ctx.newActivity({ theme: o.name, name: o.name, from: o.mainDay ?? o.from, to: o.mainDay ?? o.from, markets: entry?.markets ?? [] })}>Nová aktivita k tématu</button>
          </div>
        )}
      </div>
    </details>
  )
}
