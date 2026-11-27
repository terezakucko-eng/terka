import React, { useMemo, useState } from 'react'
import { formatRange } from '../lib/dates'
import { Empty } from './common'
import { type Ctx } from './ctx'

const SHEETS = [
  ['Sledování konkurence (akce a ceny od roku 2020)', 'https://docs.google.com/spreadsheets/d/194jOrhYnTQA3vPqf-iHHL2F4H8_oBwTktq6Q7uw4n5I/edit'],
  ['Podíl hlasu v Googlu 2024–2026', 'https://docs.google.com/spreadsheets/d/1cYBGJaFLl1HdniZfXl3CQpjX_eYgfBcRS_y-fqxXags/edit'],
] as const

export function CompetitorsView({ ctx }: { ctx: Ctx }) {
  const [who, setWho] = useState('')
  const watched = ctx.data.lists.competitors.filter((c) => c.watch)
  const rows = useMemo(() => [...ctx.competitors].filter((r) => !who || r.competitor === who).sort((a, b) => b.from.localeCompare(a.from)), [ctx.competitors, who])
  return (
    <section aria-label="Konkurence" className="stack" style={{ gap: 14 }}>
      <div className="row">
        <h2 style={{ fontSize: 20 }}>Konkurence</h2>
        <span style={{ flex: 1 }} />
        <button type="button" className="btn primary" disabled={ctx.readOnly} onClick={() => ctx.newCompetitor()}>Zapsat akci konkurence</button>
      </div>
      <div className="chipset">
        <span className="label">Sledovaní</span>
        <button type="button" className="chip" aria-pressed={who === ''} onClick={() => setWho('')}>Všichni</button>
        {watched.map((c) => <button key={c.name} type="button" className="chip" aria-pressed={who === c.name} onClick={() => setWho(who === c.name ? '' : c.name)}>{c.name} <span className="faint">{c.country}</span></button>)}
      </div>
      {rows.length ? (
        <div className="panel scroll-x" style={{ padding: 0 }}>
          <table className="t">
            <thead><tr><th>Datum</th><th>Konkurent</th><th>Země</th><th>Kanál</th><th>Co dělali</th><th>Sleva / mechanika</th><th>Jistota</th><th>Zdroj</th></tr></thead>
            <tbody>
              {rows.map((r, i) => (
                <tr key={r.id || i}>
                  <td className="num" style={{ whiteSpace: 'nowrap' }}>{formatRange(r.from, r.to)}</td>
                  <td><b>{r.competitor}</b></td><td>{r.country}</td><td>{r.channel}</td>
                  <td style={{ minWidth: 220 }}>{/^https:\/\//.test(r.link) ? <a href={r.link} target="_blank" rel="noreferrer noopener">{r.what}</a> : r.what}</td>
                  <td>{r.mechanics}</td><td>{r.confidence}</td><td className="faint">{r.source}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <Empty title="Zatím žádné záznamy">Zapiš první akci konkurence. V kalendáři ji pak jde zapnout jako šedou vrstvu přepínačem „Konkurence“.</Empty>}
      <div className="panel">
        <div className="head"><h2>Starší podklady</h2></div>
        <ul style={{ margin: 0, paddingLeft: 18 }}>{SHEETS.map(([label, href]) => <li key={href}><a href={href} target="_blank" rel="noreferrer noopener">{label}</a></li>)}</ul>
        <p className="hint" style={{ marginBottom: 0 }}>Záznamy akcí konkurence z let 2024 až 2026 se doplní ve fázi s historií, s uvedeným zdrojem a jistotou.</p>
      </div>
    </section>
  )
}
