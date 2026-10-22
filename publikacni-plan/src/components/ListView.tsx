import { ExternalLink, Store } from 'lucide-react'
import { hue } from '../lib/colors'
import { formatRange, iso, monthOf, monthTitle, type ISODate } from '../lib/dates'
import { domainSummary, storeSummary } from '../lib/format'
import { type Akce, type Links, LINK_LABELS, type Publikace, statusOf } from '../lib/model'
import { cx, StatusPill, Tag } from './ui'

export type Row =
  | { kind: 'akce'; item: Akce }
  | { kind: 'publikace'; item: Publikace }

interface Props {
  year: number
  today: ISODate
  rows: Row[]
  akceById: Map<string, Akce>
  allDomains: string[]
  allStores: string[]
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
        <a key={k} href={links[k]} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="inline-flex items-center gap-1 rounded-md bg-raised px-1.5 py-0.5 text-[11px] font-medium text-muted hover:text-ink">
          {LINK_LABELS[k].split(' ')[0]}
          <ExternalLink className="size-3" />
        </a>
      ))}
    </span>
  )
}

export function ListView({ year, today, rows, akceById, allDomains, allStores, onOpen }: Props) {
  const months = groupByMonth(rows, year)
  if (months.length === 0) {
    return <p className="rounded-2xl bg-surface px-4 py-14 text-center text-sm text-muted ring-1 ring-line">Pro rok {year} tu nic není. Zkus jiný rok nebo zruš filtry.</p>
  }
  return (
    <div className="space-y-6">
      {months.map(([m, rs]) => (
        <section key={m} className="rounded-2xl bg-surface ring-1 ring-line">
          <h3 className="sticky top-[env(safe-area-inset-top,0px)] z-10 flex items-baseline gap-2 rounded-t-2xl border-b border-line bg-surface/95 px-5 py-3 backdrop-blur">
            <span className="font-display text-lg font-semibold text-ink">{monthTitle(year, m)}</span>
            <span className="text-xs text-faint tabular-nums">{rs.length}</span>
          </h3>
          <ul className="divide-y divide-line/70">
            {rs.map((r) => {
              const isAkce = r.kind === 'akce'
              const parent = r.kind === 'publikace' && r.item.akceId ? akceById.get(r.item.akceId) : undefined
              const done = statusOf(r.item, today) === 'ukoncena'
              return (
                <li key={`${r.kind}-${r.item.id}`}>
                  <div
                    role="button"
                    tabIndex={0}
                    onClick={() => onOpen(r.kind, r.item.id)}
                    onKeyDown={(e) => (e.key === 'Enter' || e.key === ' ') && (e.preventDefault(), onOpen(r.kind, r.item.id))}
                    className="grid w-full cursor-pointer gap-x-5 gap-y-1.5 px-5 py-3 text-left transition hover:bg-raised/60 md:grid-cols-[150px_minmax(0,2fr)_minmax(0,1.3fr)_minmax(0,1.2fr)_110px] md:items-start"
                    style={isAkce ? { boxShadow: `inset 3px 0 0 ${hue(r.item.type)}` } : undefined}
                  >
                    <span className="text-[13px] font-semibold whitespace-nowrap text-muted tabular-nums">{formatRange(r.item.dateFrom, r.item.dateTo)}</span>
                    <span className="min-w-0">
                      <span className={cx('block text-[14px] leading-snug', isAkce ? 'font-bold' : 'font-medium', done ? 'text-muted' : 'text-ink')}>{r.item.name}</span>
                      {isAkce && (r.item.benefit || r.item.info) && <span className="mt-0.5 block text-xs text-muted">{[r.item.benefit, r.item.info].filter(Boolean).join(' · ')}</span>}
                      {parent && <span className="mt-0.5 block text-xs font-medium text-accent">↳ {parent.name}</span>}
                    </span>
                    <span className="flex flex-wrap gap-x-3 gap-y-1">
                      {isAkce ? <Tag hue={hue(r.item.type)}>{r.item.type}</Tag> : r.item.channels.map((c) => <Tag key={c} hue={hue(c)}>{c}</Tag>)}
                    </span>
                    <span className="min-w-0 space-y-1.5 text-xs text-muted">
                      <span className="block">{domainSummary(r.item.domains, allDomains)}</span>
                      {r.item.stores.length > 0 && (
                        <span className="flex items-start gap-1"><Store className="mt-px size-3.5 shrink-0" aria-hidden />{storeSummary(r.item.stores, allStores)}</span>
                      )}
                      <LinkIcons links={r.item.links} />
                    </span>
                    <span className="md:text-right"><StatusPill status={statusOf(r.item, today)} /></span>
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
