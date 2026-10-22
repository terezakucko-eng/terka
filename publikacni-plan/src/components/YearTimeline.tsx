import { useEffect, useRef, useState, type ReactNode } from 'react'
import { tint } from '../lib/colors'
import { daysInMonth, diffDays, iso, MONTHS, type ISODate } from '../lib/dates'
import { layoutLanes } from '../lib/layout'
import { type Akce } from '../lib/model'
import { cx } from './ui'

export interface TimelineItem {
  id: string
  kind: 'akce' | 'publikace'
  name: string
  dateFrom: ISODate
  dateTo: ISODate
  hue: string
  faded: boolean
  groups: string[]
  title: string
}

interface Props {
  year: number
  today: ISODate
  items: TimelineItem[]
  groupOrder: string[]
  /** Optional dot shown before a group label (brand or channel color). */
  groupHue?: (group: string) => string | undefined
  significant: Akce[]
  /** Many short items (publications): lanes ignore label width, so a row shows the rhythm and labels fit inside the bar. */
  compact?: boolean
  emptyText?: string
  onOpen: (kind: TimelineItem['kind'], id: string) => void
}

const LANE = 28
const COMPACT_LANE = 18
const LABEL_COLUMN = 192

/** Width of the drawing area in pixels, so label sizes can be converted into days. */
function useAreaWidth() {
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(900)
  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(Math.max(400, e.contentRect.width - LABEL_COLUMN)))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])
  return [ref, width] as const
}

/** Day offsets where February … December begin. */
function monthEdges(year: number): number[] {
  const edges: number[] = []
  for (let m = 0, acc = 0; m < 11; m++) edges.push((acc += daysInMonth(year, m)))
  return edges
}

export function YearTimeline({ year, today, items, groupOrder, groupHue, significant, compact = false, emptyText = 'V tomto roce tu nic není. Zkus jiný rok nebo zruš filtry.', onOpen }: Props) {
  const [ref, areaWidth] = useAreaWidth()
  const start = iso(year, 0, 1)
  const total = diffDays(start, iso(year, 11, 31)) + 1
  const dayPx = areaWidth / total
  /** Days a label needs, so short items are packed without their labels colliding; near December it gets what is left. */
  const labelDays = (name: string, from = 0) => Math.min(Math.ceil((name.length * 6.6 + 20) / dayPx), total - from)
  const pct = (days: number) => `${(days / total) * 100}%`
  const lane = compact ? COMPACT_LANE : LANE
  const width = compact ? (_: TimelineItem, s: number, e: number) => Math.max(e - s + 1, 2) : (i: TimelineItem, s: number, e: number) => Math.max(e - s + 1, labelDays(i.name, s))
  const groups = groupOrder
    .map((g) => ({ name: g, layout: layoutLanes(items.filter((i) => i.groups.includes(g)), start, total, width) }))
    .filter((g) => g.layout.placed.length > 0)
  const days = layoutLanes(significant, start, total, (a, s, e) => Math.max(e - s + 1, labelDays(a.name, s)))
  const todayOffset = diffDays(start, today)
  const showToday = todayOffset >= 0 && todayOffset < total
  const edges = monthEdges(year)
  const row = { edges, total, todayOffset: showToday ? todayOffset : null }

  return (
    <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
      <div ref={ref} className="min-w-[1000px]">
        <div className="flex border-b border-line">
          <div className="shrink-0" style={{ width: LABEL_COLUMN }} />
          <div className="relative flex flex-1">
            {MONTHS.map((m, i) => (
              <div key={m} className={cx('border-l border-line/70 px-2 py-2.5 text-[11px] font-bold tracking-[0.08em] uppercase', i === Number(today.slice(5, 7)) - 1 && showToday ? 'text-accent' : 'text-muted')} style={{ width: pct(daysInMonth(year, i)) }}>
                {m}
              </div>
            ))}
          </div>
        </div>

        <Row label="Významné dny" height={Math.max(1, days.lanes) * 22 + 10} {...row} tone="bg-raised/40">
          {days.placed.map(({ item: a, start: s, end: e, lane: l }) => (
            <button
              key={a.id}
              type="button"
              onClick={() => onOpen('akce', a.id)}
              className="group absolute z-10 text-left"
              style={{ left: pct(s), top: 5 + l * 22, height: 20, width: pct(Math.max(e - s + 1, labelDays(a.name, s))) }}
              title={`${a.name}${a.info ? ` – ${a.info}` : ''}`}
            >
              <span className="absolute top-0 left-0 max-w-full truncate text-[11px] leading-[14px] font-semibold text-info group-hover:underline">{a.name}</span>
              <span className="absolute bottom-0 left-0 h-1 rounded-full bg-info/70" style={{ width: `${((e - s + 1) / Math.max(e - s + 1, labelDays(a.name, s))) * 100}%`, minWidth: 4 }} />
            </button>
          ))}
        </Row>

        {groups.length === 0 && <p className="px-4 py-12 text-center text-sm text-muted">{emptyText}</p>}

        {groups.map(({ name, layout }) => (
          <Row key={name} label={name} labelHue={groupHue?.(name)} height={layout.lanes * lane + 10} {...row}>
            {layout.placed.map(({ item, start: s, end: e, lane: l, cutStart, cutEnd }) => {
              return (
                <button
                  key={`${item.kind}-${item.id}`}
                  type="button"
                  onClick={() => onOpen(item.kind, item.id)}
                  className={cx(
                    'absolute z-10 text-left font-semibold whitespace-nowrap text-ink hover:z-20 hover:brightness-[0.97]',
                    compact ? 'overflow-hidden text-[11px]' : 'overflow-visible text-xs',
                    cutStart ? 'rounded-l-none' : 'rounded-l-md',
                    cutEnd ? 'rounded-r-none' : 'rounded-r-md',
                    item.faded && 'opacity-55',
                  )}
                  style={{ left: pct(s), width: pct(Math.max(e - s + 1, compact ? 2 : 1)), top: 5 + l * lane, height: lane - 4, background: tint(item.hue, 22), boxShadow: `inset 3px 0 0 ${item.hue}` }}
                  title={item.title}
                >
                  <span className="pointer-events-none absolute inset-y-0 left-2 flex items-center">
                    <span className="truncate" style={{ maxWidth: compact ? undefined : (total - s) * dayPx - 12 }}>{item.name}</span>
                  </span>
                </button>
              )
            })}
          </Row>
        ))}
      </div>
    </div>
  )
}

function Row({ label, labelHue, height, edges, total, todayOffset, tone, children }: { label: string; labelHue?: string; height: number; edges: number[]; total: number; todayOffset: number | null; tone?: string; children: ReactNode }) {
  return (
    <div className={cx('flex border-b border-line/70 last:border-b-0', tone)}>
      <div style={{ width: LABEL_COLUMN }} className="sticky left-0 z-20 flex shrink-0 items-start gap-2 border-r border-line bg-surface px-4 py-2.5 text-[13px] font-semibold text-ink">
        {labelHue && <span className="mt-1.5 size-2 shrink-0 rounded-full" style={{ background: labelHue }} aria-hidden />}
        <span className="min-w-0 break-words">{label}</span>
      </div>
      <div className="relative flex-1 overflow-hidden" style={{ height }}>
        {edges.map((days) => <div key={days} className="absolute inset-y-0 border-l border-line/60" style={{ left: `${(days / total) * 100}%` }} />)}
        {todayOffset !== null && <div className="absolute inset-y-0 z-0 w-0.5 bg-accent/70" style={{ left: `${((todayOffset + 0.5) / total) * 100}%` }} />}
        {children}
      </div>
    </div>
  )
}
