import { ExternalLink } from 'lucide-react'
import { swatch } from '../lib/colors'
import { formatRange, iso, monthOf, monthTitle, type ISODate } from '../lib/dates'
import { domainSummary } from '../lib/format'
import { type Akce, type Links, LINK_LABELS, type Publikace, STATUS, statusOf } from '../lib/model'
import { Badge, cx } from './ui'

export type Row =
  | { kind: 'akce'; item: Akce }
  | { kind: 'publikace'; item: Publikace }

interface Props {
  year: number
  today: ISODate
  rows: Row[]
  akceById: Map<string, Akce>
  allDomains: string[]
  onOpen: (kind: Row['kind'], id: string) => void
}

/** Items grouped by the month they start in (items from last year that run into this one go to January). */
export function groupByMonth(rows: Row[], year: number): [number, Row[]][] {
  const start = iso(year, 0, 1)
  const end = iso(year, 11, 31)
  const months = new Map<number, Row[]>()
  for (const r of rows) {
    if (r.item.dateTo < start || r.item.dateFrom > end) continue
    const m = r.item.dateFrom < start ? 0 : monthOf(r.item.dateFrom)
    months.set(m, [...(months.get(m) ?? []), r])
  }
  return [...months].sort((a, b) => a[0] - b[0]).map(([m, rs]) => [
    m,
    rs.sort((a, b) => a.item.dateFrom.localeCompare(b.item.dateFrom) || (a.kind === b.kind ? 0 : a.kind === 'akce' ? -1 : 1) || a.item.name.localeCompare(b.item.name, 'cs')),
  ])
}

function LinkIcons({ links }: { links: Links }) {
  const set = (Object.keys(LINK_LABELS) as (keyof Links)[]).filter((k) => links[k])
  if (set.length === 0) return null
  return (
    <span className="flex flex-wrap gap-1">
      {set.map((k) => (
        <a key={k} href={links[k]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-0.5 rounded bg-slate-100 px-1.5 py-0.5 text-[11px] text-slate-600 hover:bg-slate-200">
          {LINK_LABELS[k].split(' ')[0]}
          <ExternalLink className="size-3" />
        </a>
      ))}
    </span>
  )
}

export function ListView({ year, today, rows, akceById, allDomains, onOpen }: Props) {
  const months = groupByMonth(rows, year)
  if (months.length === 0) {
    return <p className="rounded-xl bg-white px-4 py-12 text-center text-sm text-slate-500 ring-1 ring-slate-200">Pro rok {year} tu nic není. Zkus jiný rok nebo zruš filtry.</p>
  }
  return (
    <div className="space-y-6">
      {months.map(([m, rs]) => (
        <section key={m} className="overflow-hidden rounded-xl bg-white ring-1 ring-slate-200">
          <h3 className="flex items-baseline gap-2 border-b border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800">
            {monthTitle(year, m)}
            <span className="text-xs font-normal text-slate-500">{rs.length}</span>
          </h3>
          <ul className="divide-y divide-slate-100">
            {rs.map((r) => {
              const status = statusOf(r.item, today)
              const isAkce = r.kind === 'akce'
              const parent = r.kind === 'publikace' && r.item.akceId ? akceById.get(r.item.akceId) : undefined
              return (
                <li key={`${r.kind}-${r.item.id}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(r.kind, r.item.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(r.kind, r.item.id))}
                    className={cx('grid w-full cursor-pointer gap-x-4 gap-y-1 px-4 py-2.5 text-left hover:bg-pink-50/40 md:grid-cols-[96px_minmax(0,2fr)_150px_minmax(0,1.4fr)_minmax(0,1.2fr)]', isAkce && 'bg-pink-50/30')}
                  >
                    <span>
                      <span className={cx('inline-flex rounded-md px-1.5 py-0.5 text-[11px] font-semibold ring-1 ring-inset', STATUS[status].className)}>{STATUS[status].label}</span>
                    </span>
                    <span className="min-w-0">
                      <span className={cx('block text-sm text-slate-900', isAkce ? 'font-semibold' : 'font-medium')}>{r.item.name}</span>
                      {isAkce && (r.item.benefit || r.item.info) && <span className="block text-xs text-slate-500">{[r.item.benefit, r.item.info].filter(Boolean).join(' · ')}</span>}
                      {parent && <span className="block text-xs text-pink-700">↳ {parent.name}</span>}
                    </span>
                    <span className="text-sm whitespace-nowrap text-slate-600 tabular-nums">{formatRange(r.item.dateFrom, r.item.dateTo)}</span>
                    <span className="flex flex-wrap gap-1">
                      {isAkce
                        ? <Badge swatch={swatch(r.item.type)}>{r.item.type}</Badge>
                        : r.item.channels.map((c) => <Badge key={c} swatch={swatch(c)}>{c}</Badge>)}
                    </span>
                    <span className="min-w-0 space-y-1 text-xs text-slate-600">
                      <span className="block">{domainSummary(r.item.domains, allDomains)}</span>
                      <LinkIcons links={r.item.links} />
                    </span>
                  </div>
                </li>
              )
            })}
          </ul>
        </section>
      ))}
    </div>
  )
}
