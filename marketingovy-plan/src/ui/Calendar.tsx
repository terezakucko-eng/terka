import React, { useMemo, useState } from 'react'
import { occurrencesBetween, type Occurrence } from '../lib/calendar'
import {
  addDays, daysInYear, diffDays, formatRange, iso, mondayOf, monthOf, monthTitle, MONTHS, MONTHS_SHORT, monthWeeks, WEEKDAYS, WEEKDAYS_LONG, weekday, yearOf, type ISODate,
} from '../lib/dates'
import { layoutLanes } from '../lib/layout'
import { brandColor, brandsOf, channelGroups, groupColor, groupOf, STATUS, type Activity, type CompetitorAction, type Lists } from '../lib/model'
import { Toggle, tint, vivid } from './common'
import { type Ctx } from './ctx'

const MAX_LANES = 4

interface Span { from: ISODate; to: ISODate }
type Bar =
  | (Span & { kind: 'activity'; activity: Activity; label: string; status: string })
  | (Span & { kind: 'rival'; rival: CompetitorAction; label: string })
  | (Span & { kind: 'special'; occurrence: Occurrence; label: string })

export type ColorBy = 'kanal' | 'znacka'

/** The bar takes the colour of its channel group or of its first brand; the brands not shown by the colour get a dot. */
function activityStyle(lists: Lists, a: Activity, colorBy: ColorBy): React.CSSProperties {
  if (colorBy === 'kanal') return { background: tint(groupColor(lists, groupOf(lists, a.channel)), 30) }
  const brand = brandsOf(lists, a.markets)[0]
  return { background: tint(brand ? brandColor(lists, brand) : '#8a817d', 20) }
}

function BarButton({ bar, lists, colorBy, onOpen, cutStart, cutEnd, gridColumn, gridRow }: {
  bar: Bar; lists: Lists; colorBy: ColorBy; onOpen: () => void; cutStart: boolean; cutEnd: boolean; gridColumn: string; gridRow: number
}) {
  const cls = ['bar', cutStart ? 'cut-l' : '', cutEnd ? 'cut-r' : '']
  const style: React.CSSProperties = { gridColumn, gridRow }
  let title = bar.label
  let content: React.ReactNode = <span className="t">{bar.label}</span>
  if (bar.kind === 'activity') {
    Object.assign(style, activityStyle(lists, bar.activity, colorBy))
    if (bar.status === STATUS.idea || bar.status === STATUS.prep) cls.push('idea')
    if (bar.status === STATUS.done || bar.status === STATUS.evaluated) cls.push('done')
    const brands = brandsOf(lists, bar.activity.markets)
    title = `${bar.activity.name}\n${bar.activity.channel} · ${bar.status}\n${formatRange(bar.activity.from, bar.activity.to)}`
    const dotted = colorBy === 'kanal' ? brands : brands.slice(1)
    content = <>
      {dotted.length > 0 && <span className="dots">{dotted.map((b) => <span key={b} className="dot" style={{ background: vivid(brandColor(lists, b)) }} />)}</span>}
      <span className="t">{bar.label}</span>
    </>
  } else if (bar.kind === 'rival') {
    cls.push('rival')
    title = `${bar.rival.competitor}: ${bar.rival.what}${bar.rival.mechanics ? ` (${bar.rival.mechanics})` : ''}\n${formatRange(bar.rival.from, bar.rival.to)}`
  } else {
    cls.push('special')
    if (norm(bar.occurrence.kind) === 'sezóna') cls.push('season')
    title = `${bar.occurrence.name}${bar.occurrence.note ? `\n${bar.occurrence.note}` : ''}\n${formatRange(bar.occurrence.from, bar.occurrence.to)}`
  }
  return <button type="button" className={cls.filter(Boolean).join(' ')} style={style} title={title} onClick={onOpen}>{content}</button>
}

const norm = (s: string): string => s.trim().toLowerCase()

function barsFor(ctx: Ctx, showRivals: boolean, showSpecial: boolean, from: ISODate, to: ISODate): Bar[] {
  const bars: Bar[] = ctx.visible
    .filter((a) => a.from <= to && a.to >= from)
    .map((a) => ({ kind: 'activity', activity: a, from: a.from, to: a.to, label: a.name, status: ctx.statusOf(a) }))
  if (showRivals) {
    for (const r of ctx.competitors) {
      if (r.from <= to && r.to >= from) bars.push({ kind: 'rival', rival: r, from: r.from, to: r.to, label: `${r.competitor}: ${r.what}` })
    }
  }
  if (showSpecial) {
    for (const o of occurrencesBetween(ctx.data.calendar, from, to)) bars.push({ kind: 'special', occurrence: o, from: o.from, to: o.to, label: o.name })
  }
  // specials first, then activities, then rivals; each group by start date
  const order = { special: 0, activity: 1, rival: 2 }
  return bars.sort((a, b) => order[a.kind] - order[b.kind] || a.from.localeCompare(b.from))
}

function openBar(ctx: Ctx, bar: Bar) {
  if (bar.kind === 'activity') ctx.openActivity(bar.activity.id)
  else if (bar.kind === 'special') ctx.go('rocni-prehled', { year: yearOf(bar.occurrence.from) })
  else ctx.go('konkurence')
}

/** Brand toggles and the optional layers; the filter bar above handles brands, status and channel groups. */
export function CalendarView({ ctx, state, setState }: { ctx: Ctx; state: CalendarState; setState: (s: CalendarState) => void }) {
  const { mode, year, month, date, rivals, special, colorBy } = state
  const set = (patch: Partial<CalendarState>) => setState({ ...state, ...patch })
  const step = (n: number) => {
    if (mode === 'rok') set({ year: year + n })
    else if (mode === 'tyden') {
      const d = addDays(date, 7 * n)
      set({ date: d, year: yearOf(d), month: monthOf(d) })
    } else {
      const m = month + n
      set({ year: year + Math.floor(m / 12), month: ((m % 12) + 12) % 12 })
    }
  }
  const goToday = () => set({ year: yearOf(ctx.today), month: monthOf(ctx.today), date: ctx.today })
  const rawTitle = mode === 'rok' ? String(year) : mode === 'tyden' ? `Týden od ${formatRange(mondayOf(date), mondayOf(date), false)}` : monthTitle(year, month)
  const title = rawTitle.charAt(0).toUpperCase() + rawTitle.slice(1)

  return (
    <section aria-label="Kalendář">
      <div className="cal-head">
        <button type="button" className="btn" aria-label="Předchozí" onClick={() => step(-1)}>‹</button>
        <button type="button" className="btn" aria-label="Další" onClick={() => step(1)}>›</button>
        <h2>{title}</h2>
        <button type="button" className="btn quiet" onClick={goToday}>Dnes</button>
        <span style={{ flex: 1 }} />
        <span className="faint" style={{ fontSize: 13, fontWeight: 600 }}>Barvy podle</span>
        <Toggle label="Barvy podle" value={colorBy} onChange={(c) => set({ colorBy: c })} options={[['kanal', 'Kanálu'], ['znacka', 'Značky']]} />
        <label className="chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={special} onChange={(e) => set({ special: e.target.checked })} /> Významné dny</label>
        <label className="chip" style={{ cursor: 'pointer' }}><input type="checkbox" checked={rivals} onChange={(e) => set({ rivals: e.target.checked })} /> Konkurence</label>
        <Toggle label="Zobrazení" value={mode} onChange={(m) => set({ mode: m })} options={[['mesic', 'Měsíc'], ['tyden', 'Týden'], ['rok', 'Rok']]} />
      </div>
      {mode === 'mesic' && <MonthGrid ctx={ctx} year={year} month={month} rivals={rivals} special={special} colorBy={colorBy} />}
      {mode === 'tyden' && <WeekView ctx={ctx} date={date} rivals={rivals} special={special} colorBy={colorBy} />}
      {mode === 'rok' && <YearStrip ctx={ctx} year={year} rivals={rivals} special={special} colorBy={colorBy} />}
      {ctx.visible.length === 0 && <p className="muted" style={{ marginTop: 12 }}>Filtrům nic neodpovídá. Zruš některý filtr nebo přidej novou aktivitu.</p>}
    </section>
  )
}

export interface CalendarState { mode: 'mesic' | 'tyden' | 'rok'; year: number; month: number; date: ISODate; rivals: boolean; special: boolean; colorBy: ColorBy }

/** A month grid is too narrow to read on a phone, so there the week list is the starting view. */
export const initialCalendar = (today: ISODate): CalendarState => ({
  mode: typeof window !== 'undefined' && window.innerWidth < 760 ? 'tyden' : 'mesic', year: yearOf(today), month: monthOf(today), date: today, rivals: false, special: true, colorBy: 'kanal',
})

function MonthGrid({ ctx, year, month, rivals, special, colorBy }: { ctx: Ctx; year: number; month: number; rivals: boolean; special: boolean; colorBy: ColorBy }) {
  const weeks = useMemo(() => monthWeeks(year, month), [year, month])
  const bars = useMemo(() => barsFor(ctx, rivals, special, weeks[0][0], weeks[weeks.length - 1][6]), [ctx, rivals, special, weeks])
  const [openWeek, setOpenWeek] = useState<ISODate | null>(null)
  return (
    <div className="month">
      <div className="month-days" aria-hidden>{WEEKDAYS.map((d) => <div key={d}>{d}</div>)}</div>
      {weeks.map((week) => {
        const { placed, lanes } = layoutLanes(bars, week[0], 7)
        const expanded = openWeek === week[0]
        const limit = expanded ? lanes : MAX_LANES
        const hidden = placed.filter((p) => p.lane >= limit)
        return (
          <div className="week" key={week[0]} style={{ minHeight: 34 + Math.min(lanes, limit) * 24 + (hidden.length ? 18 : 0) + 8 }}>
            <div className="week-bg">
              {week.map((d) => (
                <div key={d} className={`daycell${monthOf(d) !== month ? ' out' : ''}${weekday(d) > 4 ? ' we' : ''}${d === ctx.today ? ' today' : ''}`}>
                  <span className="dn">{Number(d.slice(8))}</span>
                  {!ctx.readOnly && <button type="button" className="add" aria-label={`Nová aktivita ${d}`} onClick={() => ctx.newActivity({ from: d, to: d })}>+</button>}
                </div>
              ))}
            </div>
            <div className="week-fg">
              {placed.filter((p) => p.lane < limit).map((p) => (
                <BarButton key={`${p.item.kind}-${p.item.from}-${p.lane}-${p.item.label}`} bar={p.item} lists={ctx.data.lists} colorBy={colorBy} cutStart={p.cutStart} cutEnd={p.cutEnd}
                  gridColumn={`${p.start + 1} / ${p.end + 2}`} gridRow={p.lane + 1} onOpen={() => openBar(ctx, p.item)} />
              ))}
              {hidden.length > 0 && (
                <button type="button" className="more-link" style={{ gridColumn: '1 / 8', gridRow: limit + 1 }} onClick={() => setOpenWeek(expanded ? null : week[0])}>
                  {expanded ? 'Sbalit' : `+ ${hidden.length} dalších`}
                </button>
              )}
              {expanded && lanes > MAX_LANES && hidden.length === 0 && (
                <button type="button" className="more-link" style={{ gridColumn: '1 / 8', gridRow: lanes + 1 }} onClick={() => setOpenWeek(null)}>Sbalit</button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

function WeekView({ ctx, date, rivals, special, colorBy }: { ctx: Ctx; date: ISODate; rivals: boolean; special: boolean; colorBy: ColorBy }) {
  const start = mondayOf(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(start, i))
  const bars = barsFor(ctx, rivals, special, days[0], days[6])
  return (
    <div className="weekview">
      {days.map((d, i) => {
        const here = bars.filter((b) => b.from <= d && b.to >= d)
        return (
          <div key={d} className={`col${d === ctx.today ? ' today' : ''}`}>
            <h3><span>{WEEKDAYS_LONG[i]} {Number(d.slice(8))}. {Number(d.slice(5, 7))}.</span>{!ctx.readOnly && <button type="button" className="icon-btn" aria-label={`Nová aktivita ${d}`} onClick={() => ctx.newActivity({ from: d, to: d })}>+</button>}</h3>
            {here.length === 0 && <span className="faint">Nic</span>}
            {here.map((b, k) => (
              <BarButton key={`${b.kind}-${k}-${b.label}`} bar={b} lists={ctx.data.lists} colorBy={colorBy} cutStart={false} cutEnd={false} gridColumn="auto" gridRow={0} onOpen={() => openBar(ctx, b)} />
            ))}
          </div>
        )
      })}
    </div>
  )
}

/** A strip of the whole year with a row for each channel group, so the load on a channel is visible at once. */
function YearStrip({ ctx, year, rivals, special, colorBy }: { ctx: Ctx; year: number; rivals: boolean; special: boolean; colorBy: ColorBy }) {
  const first = iso(year, 0, 1), length = daysInYear(year)
  const lists = ctx.data.lists
  const groups = [...channelGroups(lists)]
  const inYear = ctx.visible.filter((a) => a.from <= iso(year, 11, 31) && a.to >= first)
  const known = new Set(groups)
  if (inYear.some((a) => !known.has(groupOf(lists, a.channel)))) groups.push('Ostatní')
  const pct = (d: ISODate) => (diffDays(first, d) / length) * 100
  const todayPct = yearOf(ctx.today) === year ? pct(ctx.today) : null

  const specials = special ? occurrencesBetween(ctx.data.calendar, first, iso(year, 11, 31)).map((o): Bar => ({ kind: 'special', occurrence: o, from: o.from, to: o.to, label: o.name })) : []
  const rivalBars = rivals ? ctx.competitors.filter((r) => r.from <= iso(year, 11, 31) && r.to >= first).map((r): Bar => ({ kind: 'rival', rival: r, from: r.from, to: r.to, label: `${r.competitor}: ${r.what}` })) : []

  const lane = (name: string, bars: Bar[], key: string) => {
    const { placed, lanes } = layoutLanes(bars.map((b) => ({ ...b, from: b.from < first ? first : b.from, to: b.to > iso(year, 11, 31) ? iso(year, 11, 31) : b.to })), first, length)
    const rows = Math.max(lanes, 1)
    return (
      <React.Fragment key={key}>
        <div className="lane-name" style={{ minHeight: rows * 22 + 8 }}>{name}</div>
        <div className="lane" style={{ minHeight: rows * 22 + 8 }}>
          <div className="grid-lines" />
          {todayPct != null && <div className="todayline" style={{ left: `${todayPct}%` }} />}
          {placed.map((p, i) => {
            const b = p.item
            const left = pct(b.from), width = Math.max(((diffDays(b.from, b.to) + 1) / length) * 100, 0.6)
            const style: React.CSSProperties = { left: `${left}%`, width: `${Math.min(width, 100 - left)}%`, top: 4 + p.lane * 22 }
            if (b.kind === 'activity') Object.assign(style, activityStyle(lists, b.activity, colorBy))
            else if (b.kind === 'rival') Object.assign(style, { background: 'var(--raised)', color: 'var(--muted)' })
            else Object.assign(style, { background: tint('#0284c7', 16), color: 'var(--info)' })
            return <button key={i} type="button" className="pbar" style={style} title={b.label} onClick={() => openBar(ctx, b)}>{b.label}</button>
          })}
        </div>
      </React.Fragment>
    )
  }

  return (
    <div className="yearstrip" role="group" aria-label={`Rok ${year}`}>
      <div className="corner" />
      <div className="months">{MONTHS.map((m, i) => <span key={m} title={m}>{MONTHS_SHORT[i]}</span>)}</div>
      {special && lane('Významné dny', specials, 'special')}
      {groups.map((g) => lane(g, inYear.filter((a) => (g === 'Ostatní' ? !known.has(groupOf(lists, a.channel)) : groupOf(lists, a.channel) === g)).map((a): Bar => ({ kind: 'activity', activity: a, from: a.from, to: a.to, label: a.name, status: ctx.statusOf(a) })), g))}
      {rivals && lane('Konkurence', rivalBars, 'rivals')}
    </div>
  )
}
