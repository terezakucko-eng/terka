import { type Swatch } from '../lib/colors'
import { daysInMonth, diffDays, iso, MONTHS, type ISODate } from '../lib/dates'
import { layoutLanes } from '../lib/layout'
import { type ReactNode } from 'react'
import { type Akce } from '../lib/model'
import { cx } from './ui'

export interface TimelineItem {
  id: string
  kind: 'akce' | 'publikace'
  name: string
  dateFrom: ISODate
  dateTo: ISODate
  swatch: Swatch
  faded: boolean
  groups: string[]
  title: string
}

interface Props {
  year: number
  today: ISODate
  items: TimelineItem[]
  groupOrder: string[]
  significant: Akce[]
  /** Many short items (publications): lanes ignore label width, so a row shows the rhythm and labels fit inside the bar. */
  compact?: boolean
  onOpen: (kind: TimelineItem['kind'], id: string) => void
}

const LANE = 26
const COMPACT_LANE = 18
/** Rough width of a label in days on a ~1100 px wide year, used to keep labels of short items apart. */
const labelDays = (name: string, total: number) => Math.ceil((name.length * 6.2 + 16) / (1100 / total))

export function YearTimeline({ year, today, items, groupOrder, significant, compact = false, onOpen }: Props) {
  const start = iso(year, 0, 1)
  const total = diffDays(start, iso(year, 11, 31)) + 1
  const pct = (days: number) => `${(days / total) * 100}%`
  const lane = compact ? COMPACT_LANE : LANE
  const width = compact ? (_: TimelineItem, s: number, e: number) => Math.max(e - s + 1, 2) : (i: TimelineItem, s: number, e: number) => Math.max(e - s + 1, labelDays(i.name, total))
  const groups = groupOrder
    .map((g) => ({ name: g, layout: layoutLanes(items.filter((i) => i.groups.includes(g)), start, total, width) }))
    .filter((g) => g.layout.placed.length > 0)
  const days = layoutLanes(significant, start, total, (a, s, e) => Math.max(e - s + 1, labelDays(a.name, total)))
  const todayOffset = diffDays(start, today)
  const showToday = todayOffset >= 0 && todayOffset < total

  return (
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
      <div className="min-w-[1000px]">
        <div className="sticky top-0 z-20 flex border-b border-slate-200 bg-slate-50">
          <div className="w-44 shrink-0 border-r border-slate-200" />
          <div className="relative flex flex-1">
            {MONTHS.map((m, i) => (
              <div key={m} className="border-r border-slate-200 px-2 py-2 text-xs font-semibold text-slate-600 uppercase last:border-r-0" style={{ width: pct(daysInMonth(year, i)) }}>
                {m}
              </div>
            ))}
          </div>
        </div>

        <Row label="Významné dny" height={Math.max(1, days.lanes) * 22 + 8} year={year} total={total} todayOffset={showToday ? todayOffset : null}>
          {days.placed.map(({ item: a, start: s, end: e, lane }) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpen('akce', a.id)}
              className="group absolute z-10 text-left"
              style={{ left: pct(s), top: 4 + lane * 22, height: 20, width: pct(Math.max(e - s + 1, labelDays(a.name, total))) }}
              title={`${a.name}${a.info ? ` – ${a.info}` : ''}`}
            >
              <span className="absolute top-0 left-0 max-w-full truncate text-[11px] leading-[14px] font-medium text-sky-800 group-hover:underline">{a.name}</span>
              <span className="absolute bottom-0 left-0 h-1 rounded-full bg-sky-400" style={{ width: `${((e - s + 1) / Math.max(e - s + 1, labelDays(a.name, total))) * 100}%`, minWidth: 4 }} />
            </button>
          ))}
        </Row>

        {groups.length === 0 && <p className="px-4 py-10 text-center text-sm text-slate-500">V tomto roce tu nic není. Zkus jiný rok nebo zruš filtry.</p>}

        {groups.map(({ name, layout }) => (
          <Row key={name} label={name} height={layout.lanes * lane + 8} year={year} total={total} todayOffset={showToday ? todayOffset : null}>
            {layout.placed.map(({ item, start: s, end: e, lane: l, cutStart, cutEnd }) => {
              // A label that would run past December hangs to the left of its bar instead.
              const flip = !compact && s + labelDays(item.name, total) > total
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => onOpen(item.kind, item.id)}
                  className={cx(
                    'absolute z-10 text-left font-medium whitespace-nowrap hover:z-20 hover:brightness-95',
                    compact ? 'overflow-hidden text-[11px]' : 'overflow-visible text-xs',
                    cutStart ? 'rounded-l-none' : 'rounded-l-md',
                    cutEnd ? 'rounded-r-none' : 'rounded-r-md',
                    item.faded && 'opacity-60',
                  )}
                  style={{ left: pct(s), width: pct(Math.max(e - s + 1, compact ? 2 : 1)), top: 4 + l * lane, height: lane - 3, background: item.swatch.bg, color: item.swatch.fg, boxShadow: `inset 3px 0 0 ${item.swatch.border}` }}
                  title={item.title}
                >
                  <span className={cx('pointer-events-none absolute inset-y-0 flex items-center', flip ? 'right-1.5' : 'left-1.5')}>{item.name}</span>
                </button>
              )
            })}
          </Row>
        ))}
      </div>
    </div>
  )
}

/** Day offsets where February … December begin. */
function monthEdges(year: number): number[] {
  const edges: number[] = []
  for (let m = 0, acc = 0; m < 11; m++) edges.push((acc += daysInMonth(year, m)))
  return edges
}

function Row({ label, height, year, total, todayOffset, children }: { label: string; height: number; year: number; total: number; todayOffset: number | null; children: ReactNode }) {
  const edges = monthEdges(year)
  return (
    <div className="flex border-b border-slate-100 last:border-b-0">
      <div className="sticky left-0 z-20 w-44 shrink-0 border-r border-slate-200 bg-white px-3 py-2 text-sm font-medium text-slate-700">{label}</div>
      <div className="relative flex-1 overflow-hidden" style={{ height }}>
        {edges.map((days) => <div key={days} className="absolute inset-y-0 border-r border-slate-100" style={{ left: `${(days / total) * 100}%` }} />)}
        {todayOffset !== null && <div className="absolute inset-y-0 z-0 w-px bg-pink-500" style={{ left: `${((todayOffset + 0.5) / total) * 100}%` }} />}
        {children}
      </div>
    </div>
  )
}
