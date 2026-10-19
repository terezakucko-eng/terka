import { CalendarDays, CalendarHeart, GanttChart, List, LogOut, Monitor, Moon, Plus, Settings, Sun, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { isDemo } from '../config'
import { logOut } from '../data/store'
import { hue } from '../lib/colors'
import { EMPTY_FILTERS, type Filters, isFiltered } from '../lib/filters'
import { brandsOf, countriesOf, type Lists, type Person } from '../lib/model'
import { useTheme, type ThemePref } from '../lib/theme'
import { type View } from '../lib/urlState'
import { Button, cx, toggle } from './ui'

const NAV: [View, string, typeof CalendarDays][] = [
  ['kalendar', 'Kalendář', CalendarDays],
  ['rok', 'Rok', GanttChart],
  ['seznam', 'Seznam', List],
  ['nastaveni', 'Nastavení', Settings],
]

const SHOWN_CHANNELS = 8

interface Props {
  view: View
  onView: (v: View) => void
  lists: Lists
  filters: Filters
  onFilters: (f: Filters) => void
  showChannels: boolean
  brandCounts: Map<string, number>
  person: Person
  photo: string | null
  onNewPublikace: () => void
  onNewAkce: () => void
  onClose?: () => void
}

export function Logo() {
  return (
    <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-accent text-accent-ink shadow-sm">
      <CalendarHeart className="size-5" aria-hidden />
    </span>
  )
}

function SectionTitle({ children, action }: { children: string; action?: ReactNode }) {
  return (
    <div className="mb-2 flex items-center justify-between px-2">
      <h3 className="text-[11px] font-bold tracking-[0.08em] text-faint uppercase">{children}</h3>
      {action}
    </div>
  )
}

export function Sidebar({ view, onView, lists, filters, onFilters, showChannels, brandCounts, person, photo, onNewPublikace, onNewAkce, onClose }: Props) {
  const [allChannels, setAllChannels] = useState(false)
  const brands = brandsOf(lists.domains)
  const countries = countriesOf(lists.domains)
  const channels = allChannels ? lists.channels : lists.channels.slice(0, SHOWN_CHANNELS)
  const go = (v: View) => {
    onView(v)
    onClose?.()
  }

  return (
    <aside className="flex h-full flex-col gap-6 overflow-y-auto bg-surface px-3 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-[max(1rem,env(safe-area-inset-bottom,0px))]">
      <div className="flex items-center gap-3 px-2">
        <Logo />
        <div className="min-w-0 flex-1 leading-tight">
          <p className="font-display text-[17px] font-semibold text-ink">Publikační plán</p>
          <p className="truncate text-[11px] text-muted">Růžový Slon · Kondomshop · Flagranti</p>
        </div>
        {onClose && (
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-raised" aria-label="Zavřít menu">
            <X className="size-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-[1fr_auto] gap-2 px-1">
        <Button variant="primary" onClick={onNewPublikace}><Plus className="size-4" /> Publikace</Button>
        <Button onClick={onNewAkce} title="Nová akce do ročního plánu"><Plus className="size-4" /> Akce</Button>
      </div>

      <nav aria-label="Pohledy" className="space-y-0.5">
        {NAV.map(([v, label, Icon]) => (
          <button
            key={v}
            type="button"
            onClick={() => go(v)}
            aria-current={view === v ? 'page' : undefined}
            className={cx(
              'flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-semibold transition',
              view === v ? 'bg-accent-soft text-accent' : 'text-muted hover:bg-raised hover:text-ink',
            )}
          >
            <Icon className="size-[18px]" /> {label}
          </button>
        ))}
      </nav>

      {view !== 'nastaveni' && (
        <div className="space-y-5">
          <section>
            <SectionTitle action={isFiltered(filters) && (
              <button type="button" onClick={() => onFilters({ ...EMPTY_FILTERS, q: filters.q })} className="text-[11px] font-semibold text-accent hover:underline">
                Zrušit filtry
              </button>
            )}>
              Značky
            </SectionTitle>
            <div className="space-y-0.5">
              {brands.map((b) => {
                const on = filters.brands.includes(b)
                return (
                  <button
                    key={b}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onFilters({ ...filters, brands: toggle(filters.brands, b) })}
                    className={cx('flex w-full items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm transition', on ? 'bg-raised font-semibold text-ink' : 'text-muted hover:bg-raised hover:text-ink')}
                  >
                    <span className={cx('flex size-4 items-center justify-center rounded-[5px] ring-1', on ? 'ring-transparent' : 'ring-line-strong')} style={on ? { background: hue(b) } : undefined} aria-hidden>
                      {on && <span className="size-1.5 rounded-full bg-white" />}
                    </span>
                    <span className="flex-1 text-left">{b}</span>
                    <span className="text-xs text-faint tabular-nums">{brandCounts.get(b) ?? 0}</span>
                  </button>
                )
              })}
            </div>
          </section>

          <section>
            <SectionTitle>Země</SectionTitle>
            <div className="grid grid-cols-4 gap-1 px-1">
              {countries.map((c) => {
                const on = filters.countries.includes(c)
                return (
                  <button
                    key={c}
                    type="button"
                    aria-pressed={on}
                    onClick={() => onFilters({ ...filters, countries: toggle(filters.countries, c) })}
                    className={cx('rounded-md py-1.5 text-xs font-bold tracking-wide transition', on ? 'bg-ink text-surface' : 'bg-raised text-muted hover:text-ink')}
                  >
                    {c}
                  </button>
                )
              })}
            </div>
          </section>

          {showChannels && (
            <section>
              <SectionTitle>Kanály</SectionTitle>
              <div className="space-y-0.5">
                {channels.map((c) => {
                  const on = filters.channels.includes(c)
                  return (
                    <label key={c} className={cx('flex cursor-pointer items-center gap-2.5 rounded-lg px-2 py-1 text-[13px] transition hover:bg-raised', on ? 'font-semibold text-ink' : 'text-muted')}>
                      <input type="checkbox" className="size-3.5 accent-accent" checked={on} onChange={() => onFilters({ ...filters, channels: toggle(filters.channels, c) })} />
                      <span className="size-2 shrink-0 rounded-full" style={{ background: hue(c) }} aria-hidden />
                      <span className="truncate">{c}</span>
                    </label>
                  )
                })}
              </div>
              {lists.channels.length > SHOWN_CHANNELS && (
                <button type="button" onClick={() => setAllChannels((v) => !v)} className="mt-1 px-2 text-xs font-semibold text-muted hover:text-ink">
                  {allChannels ? 'Méně' : `Všech ${lists.channels.length} kanálů`}
                </button>
              )}
            </section>
          )}
        </div>
      )}

      <div className="mt-auto space-y-3 border-t border-line px-2 pt-4">
        {!isDemo && <ThemeSwitch />}
        <div className="flex items-center gap-2.5" title={person.email}>
          {photo ? (
            <img src={photo} alt="" className="size-8 rounded-full" referrerPolicy="no-referrer" />
          ) : (
            <span className="flex size-8 items-center justify-center rounded-full bg-accent-soft text-sm font-bold text-accent">{person.name.slice(0, 1)}</span>
          )}
          <div className="min-w-0 flex-1 leading-tight">
            <p className="truncate text-sm font-semibold text-ink">{person.name}</p>
            <p className="truncate text-[11px] text-faint">{person.email}</p>
          </div>
          {!isDemo && (
            <button type="button" onClick={() => void logOut()} className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink" title="Odhlásit" aria-label="Odhlásit">
              <LogOut className="size-4" />
            </button>
          )}
        </div>
      </div>
    </aside>
  )
}

const THEMES: [ThemePref, string, typeof Sun][] = [
  ['light', 'Světlý', Sun],
  ['auto', 'Podle systému', Monitor],
  ['dark', 'Tmavý', Moon],
]

function ThemeSwitch() {
  const [pref, setPref] = useTheme()
  return (
    <div className="flex rounded-lg bg-raised p-0.5" role="group" aria-label="Vzhled">
      {THEMES.map(([v, label, Icon]) => (
        <button
          key={v}
          type="button"
          title={label}
          aria-label={label}
          aria-pressed={pref === v}
          onClick={() => setPref(v)}
          className={cx('flex flex-1 items-center justify-center rounded-md py-1.5 transition', pref === v ? 'bg-surface text-ink shadow-sm' : 'text-faint hover:text-ink')}
        >
          <Icon className="size-4" />
        </button>
      ))}
    </div>
  )
}
