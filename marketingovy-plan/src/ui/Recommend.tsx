import React, { useState } from 'react'
import { addDays } from '../lib/dates'
import { type Suggestion } from '../lib/recommend'
import { Empty } from './common'
import { type Ctx } from './ctx'

const RULE_NAME: Record<Suggestion['rule'], string> = { tema: 'Blíží se téma', rozpocet: 'Rozpočet bez aktivity', mezera: 'Mezera v plánu' }

export function RecommendView({ ctx, items }: { ctx: Ctx; items: Suggestion[] }) {
  return (
    <section aria-label="Doporučení" className="stack" style={{ gap: 12 }}>
      <div className="row">
        <h2 style={{ fontSize: 20 }}>Doporučení</h2>
        <span className="hint">Co by se mělo naplánovat. Rozhodnutí se ukládají, zamítnuté se znovu nenabízí.</span>
      </div>
      {!ctx.data.activities.length && <p className="muted">Doporučení z minulých let se objeví, až bude v plánu historie. Teď fungují jen pravidla z ročního kalendáře a z rozpočtu.</p>}
      {items.length === 0 ? <Empty title="Teď není co doporučit">Blížící se témata z ročního kalendáře i další týdny jsou pokryté.</Empty>
        : items.map((s) => <Card key={s.key} ctx={ctx} s={s} />)}
    </section>
  )
}

function Card({ ctx, s }: { ctx: Ctx; s: Suggestion }) {
  const [rejecting, setRejecting] = useState(false)
  const [reason, setReason] = useState('')
  return (
    <article className="suggestion">
      <div className="row"><span className="pill accent">{RULE_NAME[s.rule]}</span></div>
      <h3>{s.title}</h3>
      <ul>{s.reasons.map((r, i) => <li key={i}>{r}</li>)}</ul>
      {rejecting ? (
        <div className="row">
          <input type="text" style={{ flex: 1, minWidth: 200 }} aria-label="Důvod zamítnutí" placeholder="Proč ne? (nepovinné)" value={reason} onChange={(e) => setReason(e.target.value)} autoFocus />
          <button type="button" className="btn danger" disabled={ctx.busy || ctx.readOnly} onClick={() => ctx.decide(s.key, 'Zamítnuto', { reason })}>Zamítnout</button>
          <button type="button" className="btn quiet" onClick={() => setRejecting(false)}>Zpět</button>
        </div>
      ) : (
        <div className="row">
          {s.repeat && <button type="button" className="btn primary" disabled={ctx.busy || ctx.readOnly} onClick={() => ctx.duplicate(s.repeat!.ids, { year: s.repeat!.targetYear }, s.key)}>Založit podle loňska ({s.repeat.ids.length})</button>}
          <button type="button" className={`btn${s.repeat ? '' : ' primary'}`} disabled={ctx.readOnly} onClick={() => ctx.newActivity(s.prefill, s.key)}>Založit aktivitu</button>
          <button type="button" className="btn quiet" disabled={ctx.busy || ctx.readOnly} onClick={() => ctx.decide(s.key, 'Odloženo', { until: addDays(ctx.today, 14) })}>Odložit o 2 týdny</button>
          <button type="button" className="btn quiet" disabled={ctx.readOnly} onClick={() => setRejecting(true)}>Zamítnout…</button>
        </div>
      )}
    </article>
  )
}
