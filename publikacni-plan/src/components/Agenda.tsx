import { AlertTriangle } from 'lucide-react'
import { hue } from '../lib/colors'
import { addDays, diffDays, formatDate, formatRange, WEEKDAYS, weekday, type ISODate } from '../lib/dates'
import { domainSummary, storeSummary } from '../lib/format'
import { type Akce, type Publikace, SIGNIFICANT_DAY, statusOf } from '../lib/model'
import { Dot } from './MonthCalendar'
import { cx } from './ui'

const DAYS = 14
/** A publication starting this soon and not marked ready needs attention. */
const SOON = 7

interface Props {
  today: ISODate
  publikace: Publikace[]
  akce: Akce[]
  allDomains: string[]
  allStores: string[]
  onOpen: (kind: 'akce' | 'publikace', id: string) => void
  className?: string
}

function dayLabel(day: ISODate, today: ISODate): string {
  const d = diffDays(today, day)
  if (d === 0) return 'Dnes'
  if (d === 1) return 'Zítra'
  return `${WEEKDAYS[weekday(day)]} ${formatDate(day, false)}`
}

function Item({ p, allDomains, allStores, onOpen, today }: { p: Publikace; allDomains: string[]; allStores: string[]; onOpen: Props['onOpen']; today: ISODate }) {
  return (
    <button type="button" onClick={() => onOpen('publikace', p.id)} className="flex w-full items-start gap-2.5 rounded-lg px-2 py-1.5 text-left transition hover:bg-raised">
      <span className="mt-[5px]"><Dot hue={hue(p.channels[0] ?? '')} status={statusOf(p, today)} /></span>
      <span className="min-w-0 flex-1">
        <span className="line-clamp-2 text-[13px] leading-snug font-medium text-ink">{p.name}</span>
        <span className="mt-0.5 block truncate text-[11px] text-faint">
          {[p.channels.join(', '), domainSummary(p.domains, allDomains), storeSummary(p.stores, allStores)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </button>
  )
}

/** What goes out next, independent of the month on screen. */
export function Agenda({ today, publikace, akce, allDomains, allStores, onOpen, className }: Props) {
  const end = addDays(today, DAYS - 1)
  const runningAkce = akce.filter((a) => a.type !== SIGNIFICANT_DAY && a.dateFrom <= today && a.dateTo >= today)
  const runningPubs = publikace.filter((p) => p.dateFrom < today && p.dateTo >= today)
  const upcoming = publikace.filter((p) => p.dateFrom >= today && p.dateFrom <= end).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom) || a.name.localeCompare(b.name, 'cs'))
  const attention = upcoming.filter((p) => !p.ready && diffDays(today, p.dateFrom) < SOON)
  const days = Array.from({ length: DAYS }, (_, i) => addDays(today, i))
    .map((day) => ({
      day,
      pubs: upcoming.filter((p) => p.dateFrom === day),
      marks: akce.filter((a) => a.type === SIGNIFICANT_DAY && a.dateFrom === day),
    }))
    .filter((d) => d.pubs.length || d.marks.length)

  return (
    <aside className={cx('space-y-5', className)} aria-label="Co jde ven">
      <div>
        <h2 className="font-display text-lg font-semibold text-ink">Co jde ven</h2>
        <p className="text-xs text-muted">{formatRange(today, end)} · {upcoming.length} publikací</p>
      </div>

      {attention.length > 0 && (
        <section className="rounded-xl p-3" style={{ background: 'color-mix(in oklab, var(--warn) 10%, var(--surface))' }}>
          <h3 className="mb-1 flex items-center gap-1.5 text-xs font-bold text-warn">
            <AlertTriangle className="size-3.5" /> Do týdne a ještě nepřipraveno · {attention.length}
          </h3>
          <div className="-mx-1">
            {attention.map((p) => <Item key={p.id} p={p} allDomains={allDomains} allStores={allStores} onOpen={onOpen} today={today} />)}
          </div>
        </section>
      )}

      {(runningAkce.length > 0 || runningPubs.length > 0) && (
        <section>
          <h3 className="mb-1.5 px-2 text-[11px] font-bold tracking-[0.08em] text-faint uppercase">Právě běží</h3>
          <div className="space-y-1">
            {runningAkce.map((a) => (
              <button key={a.id} type="button" onClick={() => onOpen('akce', a.id)} className="block w-full rounded-lg px-2.5 py-1.5 text-left transition hover:brightness-[0.97]" style={{ background: `color-mix(in oklab, ${hue(a.type)} 14%, var(--surface))`, boxShadow: `inset 3px 0 0 ${hue(a.type)}` }}>
                <span className="block text-[13px] font-semibold text-ink">{a.name}</span>
                <span className="block text-[11px] text-muted">do {formatDate(a.dateTo, false)}{a.benefit ? ` · ${a.benefit}` : ''}</span>
              </button>
            ))}
            {runningPubs.map((p) => <Item key={p.id} p={p} allDomains={allDomains} allStores={allStores} onOpen={onOpen} today={today} />)}
          </div>
        </section>
      )}

      {days.length === 0 ? (
        <p className="rounded-xl bg-raised px-3 py-4 text-sm text-muted">Na příštích {DAYS} dní není nic naplánované.</p>
      ) : (
        <div className="space-y-4">
          {days.map(({ day, pubs, marks }) => (
            <section key={day}>
              <h3 className={cx('mb-1 flex items-baseline gap-2 px-2 text-xs font-bold', day === today ? 'text-accent' : 'text-ink')}>
                {dayLabel(day, today)}
                {marks.map((m) => (
                  <button key={m.id} type="button" onClick={() => onOpen('akce', m.id)} className="truncate font-semibold text-info hover:underline">✦ {m.name}</button>
                ))}
              </h3>
              {pubs.map((p) => <Item key={p.id} p={p} allDomains={allDomains} allStores={allStores} onOpen={onOpen} today={today} />)}
            </section>
          ))}
        </div>
      )}
    </aside>
  )
}
