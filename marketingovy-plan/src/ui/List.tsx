import React, { useMemo, useState } from 'react'
import { toCsv } from '../lib/csv'
import { formatDate, formatRange, yearOf } from '../lib/dates'
import { groupOf, type Activity } from '../lib/model'
import { count, money, signedMoney } from '../lib/parse'
import { totals } from '../lib/stats'
import { awaitsResult } from '../lib/status'
import { BrandDots, Empty, StatusPill, Stars } from './common'
import { type Ctx } from './ctx'

type SortKey = 'from' | 'name' | 'status' | 'channel' | 'profit'

export function ListView({ ctx }: { ctx: Ctx }) {
  const [sort, setSort] = useState<{ key: SortKey; dir: 1 | -1 }>({ key: 'from', dir: 1 })
  const [picked, setPicked] = useState<Set<string>>(new Set())
  const lists = ctx.data.lists

  const rows = useMemo(() => {
    const withTotals = ctx.visible.map((a) => ({ a, status: ctx.statusOf(a), t: totals(ctx.byId.get(a.id) ?? []) }))
    const dir = sort.dir
    const cmp: Record<SortKey, (x: (typeof withTotals)[number], y: (typeof withTotals)[number]) => number> = {
      from: (x, y) => x.a.from.localeCompare(y.a.from) || x.a.to.localeCompare(y.a.to),
      name: (x, y) => x.a.name.localeCompare(y.a.name, 'cs'),
      status: (x, y) => x.status.localeCompare(y.status, 'cs'),
      channel: (x, y) => x.a.channel.localeCompare(y.a.channel, 'cs'),
      profit: (x, y) => (x.t.profit ?? -Infinity) - (y.t.profit ?? -Infinity),
    }
    return [...withTotals].sort((x, y) => dir * cmp[sort.key](x, y))
  }, [ctx.visible, ctx.byId, ctx, sort])

  const ids = rows.map((r) => r.a.id)
  const chosen = ids.filter((id) => picked.has(id))
  const allOn = ids.length > 0 && chosen.length === ids.length
  const waiting = rows.filter((r) => awaitsResult(r.a, (ctx.byId.get(r.a.id) ?? []).length > 0, ctx.today)).map((r) => r.a.id)
  const toggle = (id: string) => setPicked((s) => { const n = new Set(s); if (n.has(id)) n.delete(id); else n.add(id); return n })
  const header = (key: SortKey, label: string, right = false) => (
    <th className={right ? 'r' : ''} aria-sort={sort.key === key ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}>
      <button type="button" className="linklike" style={{ color: 'inherit', fontWeight: 700 }} onClick={() => setSort((s) => ({ key, dir: s.key === key ? (s.dir === 1 ? -1 : 1) : 1 }))}>
        {label}{sort.key === key ? (sort.dir === 1 ? ' ↑' : ' ↓') : ''}
      </button>
    </th>
  )

  const exportCsv = () => {
    const head = ['Název', 'Datum od', 'Datum do', 'Značka a země', 'Kanál', 'Skupina kanálů', 'Odpovědný', 'Stav', 'Typ', 'Téma nebo produkt', 'Sleva / mechanika', 'Slevový kód', 'Rozpočet (Kč)', 'Skutečný náklad (Kč)', 'Tržby (Kč)', 'Objednávky', 'Hrubý zisk (Kč)', 'MKT profit 1 (Kč)', 'Hodnocení', 'Co příště jinak']
    const body = rows.map(({ a, status, t }) => [a.name, formatDate(a.from), formatDate(a.to), a.markets.join(', '), a.channel, groupOf(lists, a.channel), a.owner, status, a.type, a.theme, a.mechanics, a.code,
      a.budget ?? '', t.cost ?? '', t.revenue ?? '', t.orders ?? '', t.grossProfit ?? '', t.profit ?? '', t.rating ?? '', t.lesson])
    ctx.saveFile?.('aktivity.csv', toCsv([head, ...body]))
  }

  const evaluateChosen = () => ctx.evaluate(chosen)
  const endedChosen = chosen.filter((id) => { const a = ctx.data.activities.find((x) => x.id === id); return a != null && a.to < ctx.today })

  if (!rows.length) {
    return <Empty title="Žádné aktivity k zobrazení">{ctx.data.activities.length ? 'Filtrům nic neodpovídá. Zruš některý filtr.' : 'Zatím tu nic není.'}{!ctx.readOnly && <button className="btn primary" onClick={() => ctx.newActivity()}>Nová aktivita</button>}</Empty>
  }

  return (
    <section aria-label="Seznam aktivit">
      <div className="row" style={{ marginBottom: 8 }}>
        <span className="muted">{rows.length} {rows.length === 1 ? 'aktivita' : rows.length < 5 ? 'aktivity' : 'aktivit'}</span>
        {waiting.length > 0 && <button type="button" className="btn small" onClick={() => setPicked(new Set(waiting))}>Vybrat ty, co čekají na vyhodnocení ({waiting.length})</button>}
        <span style={{ flex: 1 }} />
        {ctx.saveFile && <button type="button" className="btn small" onClick={exportCsv}>Export do Excelu (CSV)</button>}
      </div>
      <div className="panel scroll-x" style={{ padding: 0 }}>
        <table className="t">
          <thead>
            <tr>
              <th style={{ width: 28 }}><input type="checkbox" aria-label="Vybrat všechny" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(ids))} /></th>
              {header('from', 'Datum')}
              {header('name', 'Název')}
              <th>Značka</th>
              {header('channel', 'Kanál')}
              {header('status', 'Stav')}
              <th>Odpovědný</th>
              <th className="r">Rozpočet</th>
              <th className="r">Náklad</th>
              {header('profit', 'MKT profit 1', true)}
              <th>Hodnocení</th>
            </tr>
          </thead>
          <tbody>
            {rows.map(({ a, status, t }) => (
              <tr key={a.id} className="click" onClick={() => ctx.openActivity(a.id)}>
                <td onClick={(e) => e.stopPropagation()}><input type="checkbox" aria-label={`Vybrat ${a.name}`} checked={picked.has(a.id)} onChange={() => toggle(a.id)} /></td>
                <td className="num" style={{ whiteSpace: 'nowrap' }}>{formatRange(a.from, a.to, yearOf(a.from) !== yearOf(ctx.today))}</td>
                <td style={{ minWidth: 220 }}><b>{a.name}</b>{a.theme && a.theme !== a.name && <div className="faint">{a.theme}</div>}</td>
                <td><BrandDots lists={lists} markets={a.markets} /> <span className="muted">{a.markets.length > 3 ? `${a.markets.length} trhů` : a.markets.join(', ')}</span></td>
                <td>{a.channel}</td>
                <td><StatusPill status={status} /></td>
                <td>{a.owner}</td>
                <td className="r num">{money(a.budget, false)}</td>
                <td className="r num">{money(t.cost, false)}</td>
                <td className={`r num ${t.profit != null ? (t.profit < 0 ? 'loss' : 'gain') : ''}`}>{signedMoney(t.profit)}</td>
                <td><Stars value={t.rating} /></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {chosen.length > 0 && (
        <div className="bulkbar" role="region" aria-label="Hromadné akce">
          <b>Vybráno {chosen.length}</b>
          <button type="button" className="btn small" disabled={ctx.readOnly && false} onClick={evaluateChosen}>Vyhodnotit{endedChosen.length < chosen.length ? ` (skončilo ${endedChosen.length})` : ''}</button>
          <button type="button" className="btn small" disabled={ctx.busy || ctx.readOnly} onClick={() => { ctx.duplicate(chosen, { shift: 1 }); setPicked(new Set()) }}>Duplikovat o rok</button>
          <button type="button" className="btn small danger" disabled={ctx.busy || ctx.readOnly} onClick={() => ctx.remove(chosen)}>Smazat…</button>
          <span style={{ flex: 1 }} />
          <button type="button" className="btn small" onClick={() => setPicked(new Set())}>Zrušit výběr</button>
        </div>
      )}
      <p className="hint" style={{ marginTop: 10 }}>{count(ctx.data.activities.length)} aktivit celkem v tabulce, včetně zrušených a smazaných.</p>
    </section>
  )
}

export type { Activity }
