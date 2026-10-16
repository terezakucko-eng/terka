import { Check } from 'lucide-react'
import { useRef, useState, type DragEvent } from 'react'
import { NEUTRAL, swatch, type Swatch } from '../lib/colors'
import { addDays, diffDays, monthOf, monthWeeks, WEEKDAYS, type ISODate } from '../lib/dates'
import { domainSummary } from '../lib/format'
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
  colorBy: ColorBy
  onOpenPublikace: (id: string) => void
  onOpenAkce: (id: string) => void
  onNew: (date: ISODate) => void
  onMove: (p: Publikace, dateFrom: ISODate, dateTo: ISODate) => void
}

export function pubSwatch(p: Publikace, colorBy: ColorBy, akceById: Map<string, Akce>): Swatch {
  if (colorBy === 'akce') {
    const a = p.akceId ? akceById.get(p.akceId) : undefined
    return a ? swatch(a.name) : NEUTRAL
  }
  if (colorBy === 'znacka') return swatch(brandsOf(p.domains)[0] ?? '')
  return p.channels[0] ? swatch(p.channels[0]) : NEUTRAL
}

/** Day number, significant-day labels, plan bands, publication lanes, then free space to click into. */
function tracks(markers: number, bands: number, pubs: number): string {
  return ['24px', ...Array(markers).fill('18px'), ...Array(bands).fill('20px'), ...Array(pubs).fill('24px'), 'minmax(28px, 1fr)'].join(' ')
}

export function MonthCalendar({ year, month0, today, publikace, akce, allDomains, colorBy, onOpenPublikace, onOpenAkce, onNew, onMove }: Props) {
  const weeks = monthWeeks(year, month0)
  const akceById = new Map(akce.map((a) => [a.id, a]))
  const dayMarkers = akce.filter((a) => a.type === SIGNIFICANT_DAY && a.dateFrom === a.dateTo)
  const bands = akce.filter((a) => !(a.type === SIGNIFICANT_DAY && a.dateFrom === a.dateTo))
  const drag = useRef<{ id: string; grabbed: ISODate } | null>(null)
  const [dragging, setDragging] = useState(false)
  const [over, setOver] = useState<ISODate | null>(null)

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
    <div className="overflow-x-auto rounded-xl bg-white ring-1 ring-slate-200">
      <div className="min-w-[760px]">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50 text-xs font-semibold text-slate-500 uppercase">
          {WEEKDAYS.map((d) => (
            <div key={d} className="px-2 py-2">{d}</div>
          ))}
        </div>
        {weeks.map((week) => {
          const weekStart = week[0]
          const weekEnd = week[6]
          const bandLayout = layoutLanes(bands, weekStart, 7)
          const pubLayout = layoutLanes(publikace, weekStart, 7)
          const markersByDay = new Map(week.map((d) => [d, dayMarkers.filter((m) => m.dateFrom === d)]))
          const markerRows = Math.max(0, ...[...markersByDay.values()].map((m) => m.length))
          const headRows = 1 + markerRows
          const rows = headRows + bandLayout.lanes + pubLayout.lanes + 1
          return (
            <div
              key={weekStart}
              className="relative grid grid-cols-7 border-b border-slate-200 last:border-b-0"
              style={{ gridTemplateRows: tracks(markerRows, bandLayout.lanes, pubLayout.lanes), minHeight: 104 }}
              data-week={weekStart}
            >
              {week.map((day, i) => {
                const inMonth = monthOf(day) === month0
                const weekend = i >= 5
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
                      'cursor-pointer border-r border-slate-100 transition-colors last:border-r-0 hover:bg-pink-50/40',
                      !inMonth && 'bg-slate-50/80',
                      weekend && inMonth && 'bg-slate-50/40',
                      over === day && 'bg-pink-100/70',
                    )}
                    style={{ gridColumn: i + 1, gridRow: `1 / span ${rows}` }}
                    title="Klikni pro novou publikaci"
                  />
                )
              })}
              {week.map((day, i) => (
                <div key={`n-${day}`} className="pointer-events-none flex items-center px-2" style={{ gridColumn: i + 1, gridRow: 1 }}>
                  <span
                    className={cx(
                      'flex size-6 items-center justify-center rounded-full text-xs font-semibold',
                      day === today ? 'bg-pink-600 text-white' : monthOf(day) === month0 ? 'text-slate-700' : 'text-slate-400',
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
                    className={cx('z-10 mx-1 truncate text-left text-[11px] leading-[18px] font-medium text-sky-700 hover:underline', dragging && 'pointer-events-none')}
                    style={{ gridColumn: i + 1, gridRow: 2 + j }}
                    title={`${m.name}${m.info ? ` – ${m.info}` : ''}`}
                  >
                    ★ {m.name}
                  </button>
                )),
              )}
              {bandLayout.placed.map(({ item: a, start, end, lane, cutStart, cutEnd }) => {
                const sw = swatch(a.type)
                return (
                  <button
                    key={`${a.id}-${weekStart}`}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation()
                      onOpenAkce(a.id)
                    }}
                    className={cx(
                      'z-10 my-[2px] truncate px-2 text-left text-[11px] leading-4 font-semibold uppercase tracking-wide hover:brightness-95',
                      cutStart ? 'ml-0 rounded-l-none' : 'ml-1 rounded-l',
                      cutEnd ? 'mr-0 rounded-r-none' : 'mr-1 rounded-r',
                      dragging && 'pointer-events-none',
                    )}
                    style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: headRows + 1 + lane, background: sw.bg, color: sw.fg, borderBottom: `2px solid ${sw.border}` }}
                    title={`${a.type}: ${a.name}`}
                  >
                    {a.name}
                  </button>
                )
              })}
              {pubLayout.placed.map(({ item: p, start, end, lane, cutStart, cutEnd }) => {
                const sw = pubSwatch(p, colorBy, akceById)
                const status = statusOf(p, today)
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
                      'z-10 my-[2px] flex items-center gap-1 truncate px-1.5 text-left text-xs font-medium shadow-[0_1px_0_rgba(0,0,0,0.04)] hover:brightness-95',
                      cutStart ? 'ml-0 rounded-l-none' : 'ml-1 rounded-l-md',
                      cutEnd ? 'mr-0 rounded-r-none' : 'mr-1 rounded-r-md',
                      status === 'ukoncena' && 'opacity-60',
                      status === 'priprava' && 'border border-dashed',
                      dragging && 'pointer-events-none',
                    )}
                    style={{ gridColumn: `${start + 1} / ${end + 2}`, gridRow: headRows + bandLayout.lanes + 1 + lane, background: sw.bg, color: sw.fg, borderColor: sw.border, boxShadow: `inset 3px 0 0 ${sw.border}` }}
                    title={[
                      p.name,
                      `${STATUS[status].label} · ${p.dateFrom === p.dateTo ? p.dateFrom : `${p.dateFrom} – ${p.dateTo}`}`,
                      p.channels.join(', '),
                      domainSummary(p.domains, allDomains),
                    ].filter(Boolean).join('\n')}
                  >
                    {status === 'kespusteni' && <Check className="size-3 shrink-0" aria-label="připraveno" />}
                    <span className="truncate">{p.name}</span>
                  </button>
                )
              })}
              <span className="sr-only">{`Týden ${weekStart} – ${weekEnd}`}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}
