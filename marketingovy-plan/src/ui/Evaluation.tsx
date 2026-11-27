import React, { useMemo, useState } from 'react'
import { formatDate, MONTHS_SHORT, yearOf } from '../lib/dates'
import { brandColor } from '../lib/model'
import { money, moneyShort, signedMoney } from '../lib/parse'
import { pendingEvaluation, planVsActual, ranked } from '../lib/stats'
import { Empty, Toggle, vivid } from './common'
import { type Ctx } from './ctx'

const total = (xs: number[]): number => xs.reduce((a, b) => a + b, 0)

export function EvaluationView({ ctx, year, setYear }: { ctx: Ctx; year: number; setYear: (y: number) => void }) {
  const [mode, setMode] = useState<'activity' | 'theme'>('activity')
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const lists = ctx.data.lists

  const years = useMemo(() => {
    const ys = new Set<number>([yearOf(ctx.today), year, ...ctx.data.activities.map((a) => yearOf(a.from)), ...ctx.data.monthly.map((m) => Number(m.month.slice(0, 4)))])
    return [...ys].sort()
  }, [ctx.data, ctx.today, year])

  const series = useMemo(() => planVsActual(ctx.visible, ctx.byId, ctx.data.monthly, lists, year), [ctx.visible, ctx.byId, ctx.data.monthly, lists, year])
  const brands = [...series.keys()].filter((b) => !ctx.filters.brands.length || ctx.filters.brands.includes(b))
  const rows = useMemo(() => ranked(ctx.visible, ctx.byId, mode, year), [ctx.visible, ctx.byId, mode, year])
  const top = rows.filter((r) => r.profit > 0).slice(0, 5)
  const flop = [...rows].reverse().filter((r) => !top.includes(r)).slice(0, 5)
  const waiting = useMemo(() => pendingEvaluation(ctx.visible, ctx.byId, ctx.today), [ctx.visible, ctx.byId, ctx.today])
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const chosen = waiting.filter((a) => picked.has(a.id)).map((a) => a.id)
  const anyData = brands.some((b) => { const s = series.get(b)!; return [...s.plan, ...s.actual, ...s.financeActual, ...s.financePlan].some((x) => x !== 0) })

  const cell = (n: number, i: number, over?: boolean) => <td className={`r num${over ? ' over' : ''}`} key={i}>{n ? moneyShort(n) : ''}</td>

  return (
    <section aria-label="Vyhodnocení" className="stack" style={{ gap: 16 }}>
      <div className="row">
        <h2 style={{ fontSize: 20 }}>Vyhodnocení</h2>
        <select aria-label="Rok" style={{ width: 'auto' }} value={year} onChange={(e) => setYear(Number(e.target.value))}>{years.map((y) => <option key={y}>{y}</option>)}</select>
        <span className="hint">Aktivita se počítá do měsíce, ve kterém začíná. Filtry nahoře platí i tady.</span>
      </div>

      <div className="panel">
        <div className="head"><h2>Plán × skutečnost po měsících a značkách</h2></div>
        {anyData ? (
          <div className="scroll-x">
            <table className="t">
              <thead><tr><th>Značka</th><th /> {MONTHS_SHORT.map((m) => <th key={m} className="r">{m}</th>)}<th className="r">Celkem</th></tr></thead>
              <tbody>
                {brands.map((brand) => {
                  const s = series.get(brand)!
                  const dot = <span className="dot" style={{ background: vivid(brandColor(lists, brand)), marginRight: 6 }} />
                  const hasFinance = s.financeActual.some(Boolean) || s.financePlan.some(Boolean)
                  return (
                    <React.Fragment key={brand}>
                      <tr><td rowSpan={hasFinance ? 3 : 2}><b>{dot}{brand}</b></td><td className="muted">Plán (rozpočty aktivit)</td>{s.plan.map((n, i) => cell(n, i))}<td className="r num"><b>{moneyShort(total(s.plan))}</b></td></tr>
                      <tr><td className="muted">Skutečnost (výsledky)</td>{s.actual.map((n, i) => cell(n, i, s.plan[i] > 0 && n > s.plan[i] * 1.05))}<td className={`r num${total(s.plan) > 0 && total(s.actual) > total(s.plan) * 1.05 ? ' over' : ''}`}><b>{moneyShort(total(s.actual))}</b></td></tr>
                      {hasFinance && <tr><td className="muted">Finanční plán (skutečné náklady)</td>{s.financeActual.map((n, i) => cell(n, i))}<td className="r num"><b>{moneyShort(total(s.financeActual))}</b></td></tr>}
                    </React.Fragment>
                  )
                })}
              </tbody>
            </table>
          </div>
        ) : <Empty title={`Za rok ${year} zatím nic k porovnání`}>Čísla se objeví, jakmile mají aktivity rozpočet a výsledek nebo je list Měsíční čísla naplněný.</Empty>}
        <p className="hint" style={{ marginTop: 8 }}>Oranžově je skutečnost nad plánem o víc než 5 %. Částky v Kč bez DPH, tisíce a miliony zkráceně.</p>
      </div>

      <div className="cards">
        {([['Nejlepší', top, 'gain'], ['Nejhorší', flop, 'loss']] as const).map(([title, list, tone]) => (
          <div className="panel" key={title}>
            <div className="head">
              <h2>{title} podle MKT profitu 1</h2>
              <span className="grow" />
              {title === 'Nejlepší' && <Toggle label="Po čem řadit" value={mode} onChange={setMode} options={[['activity', 'Aktivity'], ['theme', 'Témata']]} />}
            </div>
            {list.length ? (
              <ol className="rank">
                {list.map((r, i) => (
                  <li key={r.key}>
                    <span className="n">{i + 1}.</span>
                    <span>{r.activityIds.length === 1 ? <button type="button" className="linklike" onClick={() => ctx.openActivity(r.activityIds[0])}>{r.label}</button> : <b>{r.label}</b>}<div className="faint">{r.sub}</div></span>
                    <span className={`num ${tone}`}>{signedMoney(r.profit)}</span>
                  </li>
                ))}
              </ol>
            ) : <span className="muted">{rows.length ? 'Zatím nic k zobrazení.' : 'Po vyplnění výsledků s tržbami tu uvidíš pořadí.'}</span>}
          </div>
        ))}
      </div>

      <div className="panel">
        <div className="head">
          <h2>Čeká na vyhodnocení ({waiting.length})</h2>
          <span className="grow" />
          {waiting.length > 0 && <button type="button" className="btn small" onClick={() => setPicked(chosen.length === waiting.length ? new Set() : new Set(waiting.map((a) => a.id)))}>{chosen.length === waiting.length ? 'Zrušit výběr' : 'Vybrat vše'}</button>}
          <button type="button" className="btn small primary" disabled={!chosen.length} onClick={() => ctx.evaluate(chosen)}>Vyhodnotit vybrané{chosen.length ? ` (${chosen.length})` : ''}</button>
        </div>
        {waiting.length ? (
          <div className="scroll-x">
            <table className="t">
              <thead><tr><th style={{ width: 28 }} /><th>Skončilo</th><th>Aktivita</th><th>Kanál</th><th>Odpovědný</th><th className="r">Rozpočet</th><th /></tr></thead>
              <tbody>
                {waiting.map((a) => (
                  <tr key={a.id}>
                    <td><input type="checkbox" aria-label={`Vybrat ${a.name}`} checked={picked.has(a.id)} onChange={() => toggle(a.id)} /></td>
                    <td className="num">{formatDate(a.to)}</td>
                    <td><button type="button" className="linklike" onClick={() => ctx.openActivity(a.id)}>{a.name}</button></td>
                    <td>{a.channel}</td><td>{a.owner}</td><td className="r num">{money(a.budget, false)}</td>
                    <td className="r"><button type="button" className="btn small" onClick={() => ctx.evaluate([a.id])}>Vyplnit</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : <span className="muted">Všechno, co skončilo, je vyhodnocené. Čekají jen schválené aktivity, které už skončily a nemají výsledek.</span>}
      </div>
    </section>
  )
}
