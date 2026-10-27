import { Check, Store } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { hue, NEUTRAL_HUE, tint } from '../lib/colors'
import { addDays, diffDays, formatRange, monthOf, monthWeeks, WEEKDAYS, type ISODate } from '../lib/dates'
import { domainSummary, storeSummary } from '../lib/format'
import { layoutLanes } from '../lib/layout'
import { type Akce, brandsOf, type Publikace, SIGNIFICANT_DAY, STATUS, statusOf } from '../lib/model'
import { type ColorBy } from '../lib/urlState'
import { cx } from './ui'

interface Props {
  year: number
  month0: number
  today: ISODate
  publikace: Publikace[]
  akce: Akce[]
  allDomains: string[]
  allStores: string[]
  colorBy: ColorBy
  onOpenPublikace: (id: string) => void
  onOpenAkce: (id: string) => void
  onNew: (date: ISODate) => void
  onMove: (p: Publikace, dateFrom: ISODate, dateTo: ISODate) => void
  onLegend?: (key: string) => void
  activeLegend?: string[]
}

/** The key a publication is colored by: its first channel, its brand, or its plan item. */
export function colorKey(p: Publikace, colorBy: ColorBy, akceById: Map<string, Akce>): string {
  if (colorBy === 'akce') return (p.akceId && akceById.get(p.akceId)?.name) || ''
  if (colorBy === 'znacka') return brandsOf(p.domains)[0] ?? ''
  return p.channels[0] ?? ''
}

export const pubHue = (p: Publikace, colorBy: ColorBy, akceById: Map<string, Akce>): string => {
  const key = colorKey(p, colorBy, akceById)
  return key ? hue(key) : NEUTRAL_HUE
}

/** Day number, significant-day labels, plan ribbons, publication lanes, then free space to click into. */
function tracks(markers: number, bands: number, pubs: number): string {
  return ['30px', ...Array(markers).fill('18px'), ...Array(bands).fill('22px'), ...Array(pubs).fill('24px'), 'minmax(24px, 1fr)'].join(' ')
}

export function MonthCalendar({ year, month0, today, publikace, akce, allDomains, allStores, colorBy, onOpenPublikace, onOpenAkce, onNew, onMove, onLegend, activeLegend = [] }: Props) {
  const weeks = monthWeeks(year, month0)
  const akceById = new Map(akce.map((a) => [a.id, a]))
  const dayMarkers = akce.filter((a) => a.type === SIGNIFICANT_DAY && a.dateFrom === a.dateTo)
  const bands = akce.filter((a) => !(a.type === SIGNIFICANT_DAY && a.dateFrom === a.dateTo))
  const drag = useRef<{ id: string; grabbed: ISODate } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState<ISODate | null>(null)

  const monthStart = weeks[0][0]
  const monthEnd = weeks.at(-1)![6]
  const legend = [...new Set(publikace.filter((p) => p.dateFrom <= monthEnd && p.dateTo >= monthStart).map((p) => colorKey(p, colorBy, akceById)))]
    .filter(Boolean)
    .sort((a, b) => a.localeCompare(b, 'cs'))

  const startDrag = (e: DragEvent, p: Publikace, weekStart: ISODate, start: number, end: number) => {
    const rect = e.currentTarget.getBoundingClientRect()
    const col = start + Math.min(end - start, Math.floor(((e.clientX - rect.left) / rect.width) * (end - start + 1)))
    drag.current = { id: p.id, grabbed: addDays(weekStart, col) }
    e.dataTransfer.effectAllowed = 'move'
    e.dataTransfer.setData('text/plain', p.id)
    setTimeout(() => setDragging(true))
  }

  const endDrag = () => {
    drag.current = null
    setDragging(false)
    setOver(null)
  }

  const drop = (day: ISODate) => {
    const d = drag.current
    endDrag()
    const p = d && publikace.find((x) => x.id === d.id)
    if (!d || !p) return
    const delta = diffDays(d.grabbed, day)
    if (delta !== 0) onMove(p, addDays(p.dateFrom, delta), addDays(p.dateTo, delta))
  }

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto rounded-2xl bg-surface ring-1 ring-line">
        <div className="min-w-[760px]">
          <div className="grid grid-cols-7 border-b border-line">
            {WEEKDAYS.map((d, i) => (
              <div key={d} className={cx('px-3 py-2.5 text-[11px] font-bold tracking-[0.08em] uppercase', i >= 5 ? 'text-faint' : 'text-muted')}>{d}</div>
            ))}
          </div>
          {weeks.map((week) => {
            const weekStart = week[0]
            const bandLayout = layoutLanes(bands, weekStart, 7)
            const pubLayout = layoutLanes(publikace, weekStart, 7)
            const markersByDay = new Map(week.map((d) => [d, dayMarkers.filter((m) => m.dateFrom === d)]))
            const markerRows = Math.max(0, ...[...markersByDay.values()].map((m) => m.length))
            const headRows = 1 + markerRows
            const rows = headRows + bandLayout.lanes + pubLayout.lanes + 1
            return (
              <div
                key={weekStart}
                className="relative grid grid-cols-7 border-b border-line last:border-b-0"
                style={{ gridTemplateRows: tracks(markerRows, bandLayout.lanes, pubLayout.lanes), minHeight: 112 }}
                data-week={weekStart}
              >
                {week.map((day, i) => {
                  const inMonth = monthOf(day) === month0
                  return (
                    <div
                      key={day}
                      data-day={day}
                      onClick={() => onNew(day)}
                      onDragOver={(e) => {
                        if (!drag.current) return
                        e.preventDefault()
                        setOver(day)
                      }}
                      onDragLeave={() => setOver((o) => (o === day ? null : o))}
                      onDrop={(e) => {
                        e.preventDefault()
                        drop(day)
                      }}
                      className={cx(
                        'group/day cursor-pointer border-r border-line/70 transition-colors last:border-r-0',
                        !inMonth && 'bg-raised/60',
                        inMonth && i >= 5 && 'bg-raised/30',
                        over === day ? 'bg-accent-soft' : 'hover:bg-accent-soft/40',
                      )}
                      style={{ gridColumn: i + 1, gridRow: `1 / span ${rows}` }}
                      title="Klikni pro novou publikaci"
                    />
                  )
                })}
                {week.map((day, i) => (
                  <div key={`n-${day}`} className="pointer-events-none flex items-center justify-between px-2" style={{ gridColumn: i + 1, gridRow: 1 }}>
                    <span
                      className={cx(
                        'flex h-6 min-w-6 items-center justify-center rounded-full px-1 text-[13px] font-semibold tabular-nums',
                        day === today ? 'bg-accent text-accent-ink' : monthOf(day) === month0 ? 'text-ink' : 'text-faint',
                      )}
                    >
                      {Number(day.slice(8))}
                    </span>
                  </div>
                ))}
                {week.flatMap((day, i) =>
                  (markersByDay.get(day) ?? []).map((m, j) => (
                    <button
                      key={m.id}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenAkce(m.id)
                      }}
                      className={cx('z-10 mx-2 truncate text-left text-[11px] leading-[18px] font-semibold text-info hover:underline', dragging && 'pointer-events-none')}
                      style={{ gridColumn: i + 1, gridRow: 2 + j }}
                      title={`${m.name}${m.info ? ` – ${m.info}` : ''}`}
                    >
                      ✦ {m.name}
                    </button>
                  )),
                )}
                {bandLayout.placed.map(({ item: a, start, end, lane, cutStart, cutEnd }) => {
                  const h = hue(a.type)
                  return (
                    <button
                      key={`${a.id}-${weekStart}`}
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenAkce(a.id)
                      }}
                      className={cx(
                        'z-10 my-[2px] truncate px-2 text-left text-[11px] leading-4 font-bold text-ink hover:brightness-[0.97]',
                        cutStart ? 'ml-0 rounded-l-none' : 'ml-1.5 rounded-l-md',
                        cutEnd ? 'mr-0 rounded-r-none' : 'mr-1.5 rounded-r-md',
                        statusOf(a, today) === 'ukoncena' && 'opacity-60',
                        dragging && 'pointer-events-none',
                      )}
                      style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: headRows + 1 + lane, background: tint(h, 20), boxShadow: cutStart ? undefined : `inset 3px 0 0 ${h}` }}
                      title={[`${a.type}: ${a.name}`, a.benefit, a.stores.length ? `Prodejny: ${storeSummary(a.stores, allStores)}` : ''].filter(Boolean).join('\n')}
                    >
                      {a.name}
                    </button>
                  )
                })}
                {pubLayout.placed.map(({ item: p, start, end, lane, cutStart, cutEnd }) => {
                  const h = pubHue(p, colorBy, akceById)
                  const status = statusOf(p, today)
                  const span = end > start || cutStart || cutEnd
                  const done = status === 'ukoncena'
                  return (
                    <button
                      key={`${p.id}-${weekStart}`}
                      type="button"
                      draggable
                      data-pub={p.id}
                      onDragStart={(e) => startDrag(e, p, weekStart, start, end)}
                      onDragEnd={endDrag}
                      onClick={(e) => {
                        e.stopPropagation()
                        onOpenPublikace(p.id)
                      }}
                      className={cx(
                        'z-10 my-[1px] flex items-center gap-1.5 truncate px-1.5 text-left text-[12px] font-medium transition-colors',
                        cutStart ? 'ml-0 rounded-l-none' : 'ml-1 rounded-l-md',
                        cutEnd ? 'mr-0 rounded-r-none' : 'mr-1 rounded-r-md',
                        done ? 'text-muted' : 'text-ink',
                        !span && 'hover:bg-raised',
                        dragging && 'pointer-events-none',
                      )}
                      style={span ? { gridColumn: `${start + 1} / ${end + 2}`, gridRow: headRows + bandLayout.lanes + 1 + lane, background: tint(h, done ? 8 : 14) } : { gridColumn: `${start + 1} / ${end + 2}`, gridRow: headRows + bandLayout.lanes + 1 + lane }}
                      title={[
                        p.name,
                        `${STATUS[status].label} · ${formatRange(p.dateFrom, p.dateTo)}`,
                        p.channels.join(', '),
                        domainSummary(p.domains, allDomains),
                        p.stores.length ? `Prodejny: ${storeSummary(p.stores, allStores)}` : '',
                      ].filter(Boolean).join('\n')}
                    >
                      <Dot hue={h} status={status} />
                      <span className="truncate">{p.name}</span>
                      {p.stores.length > 0 && <Store className="size-3 shrink-0 text-faint" aria-label="pro prodejny" />}
                      {status === 'kespusteni' && <Check className="size-3 shrink-0 text-info" aria-label="připraveno" />}
                    </button>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {legend.length > 0 && (
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 px-1 text-xs text-muted">
          {legend.map((k) => {
            const on = activeLegend.includes(k)
            return onLegend ? (
              <button key={k} type="button" onClick={() => onLegend(k)} aria-pressed={on} className={cx('inline-flex items-center gap-1.5 hover:text-ink', on && 'font-semibold text-ink')}>
                <span className="size-2 rounded-full" style={{ background: hue(k) }} aria-hidden />
                {k}
              </button>
            ) : (
              <span key={k} className="inline-flex items-center gap-1.5">
                <span className="size-2 rounded-full" style={{ background: hue(k) }} aria-hidden />
                {k}
              </span>
            )
          })}
          <span className="ml-auto inline-flex items-center gap-3 text-faint">
            <span className="inline-flex items-center gap-1.5"><Dot hue={NEUTRAL_HUE} status="priprava" /> v přípravě</span>
            <span className="inline-flex items-center gap-1.5"><Dot hue={NEUTRAL_HUE} status="aktivni" /> připraveno / běží</span>
          </span>
        </div>
      )}
    </div>
  )
}

/** Filled when ready or running, a ring while still being prepared, faded once over. */
export function Dot({ hue: h, status }: { hue: string; status: keyof typeof STATUS }) {
  const hollow = status === 'priprava'
  return (
    <span
      className="size-2 shrink-0 rounded-full"
      style={hollow ? { boxShadow: `inset 0 0 0 1.5px ${h}` } : { background: h, opacity: status === 'ukoncena' ? 0.45 : 1 }}
      aria-hidden
    />
  )
}
