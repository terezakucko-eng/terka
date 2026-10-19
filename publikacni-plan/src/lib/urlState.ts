import { useCallback, useEffect, useState } from 'react'
import { EMPTY_FILTERS, type Filters } from './filters'

export type View = 'kalendar' | 'rok' | 'seznam' | 'nastaveni'
export type Mode = 'akce' | 'publikace' | 'vse'
export type ColorBy = 'kanal' | 'akce' | 'znacka'

export interface ViewState {
  view: View
  year: number
  month0: number
  mode: Mode
  group: string
  colors: ColorBy
  filters: Filters
  /** 'p:<id>' or 'a:<id>' – the item open in a dialog, so a link can point straight at it */
  open: string | null
}

const VIEWS: View[] = ['kalendar', 'rok', 'seznam', 'nastaveni']
const list = (v: string | null) => (v ? v.split(',').filter(Boolean) : [])

export function parse(search: string, now = new Date()): ViewState {
  const p = new URLSearchParams(search)
  const m = /^(\d{4})-(\d{2})$/.exec(p.get('m') ?? '')
  const view = p.get('v') as View
  const mode = p.get('zobrazit') as Mode
  const colors = p.get('barvy') as ColorBy
  return {
    view: VIEWS.includes(view) ? view : 'kalendar',
    year: m ? Number(m[1]) : now.getFullYear(),
    month0: m ? Math.min(11, Math.max(0, Number(m[2]) - 1)) : now.getMonth(),
    mode: ['akce', 'publikace', 'vse'].includes(mode) ? mode : 'akce',
    group: p.get('skupiny') ?? '',
    colors: ['kanal', 'akce', 'znacka'].includes(colors) ? colors : 'kanal',
    filters: { ...EMPTY_FILTERS, brands: list(p.get('znacka')), countries: list(p.get('zeme')), channels: list(p.get('kanal')), q: p.get('q') ?? '' },
    open: p.get('open'),
  }
}

export function serialize(s: ViewState): string {
  const p = new URLSearchParams()
  if (s.view !== 'kalendar') p.set('v', s.view)
  p.set('m', `${s.year}-${String(s.month0 + 1).padStart(2, '0')}`)
  if (s.view !== 'kalendar' && s.mode !== 'akce') p.set('zobrazit', s.mode)
  if (s.group) p.set('skupiny', s.group)
  if (s.colors !== 'kanal') p.set('barvy', s.colors)
  if (s.filters.brands.length) p.set('znacka', s.filters.brands.join(','))
  if (s.filters.countries.length) p.set('zeme', s.filters.countries.join(','))
  if (s.filters.channels.length) p.set('kanal', s.filters.channels.join(','))
  if (s.filters.q) p.set('q', s.filters.q)
  if (s.open) p.set('open', s.open)
  return `?${p.toString()}`
}

/** View, month, filters and the open item live in the address, so any screen can be shared as a link. */
export function useUrlState(): [ViewState, (patch: Partial<ViewState>) => void] {
  const [state, setState] = useState(() => parse(location.search))
  useEffect(() => {
    const next = serialize(state)
    try {
      if (next !== location.search) history.replaceState(null, '', next)
    } catch {
      // sandboxed frames may refuse history changes; the app works without the address sync
    }
  }, [state])
  const update = useCallback((patch: Partial<ViewState>) => setState((s) => ({ ...s, ...patch })), [])
  return [state, update]
}
