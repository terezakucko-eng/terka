import { ChevronDown, Search, X } from 'lucide-react'
import { swatch } from '../lib/colors'
import { EMPTY_FILTERS, type Filters, isFiltered } from '../lib/filters'
import { brandsOf, countriesOf, type Lists } from '../lib/model'
import { Chip, cx, inputClass, toggle } from './ui'

export function FilterBar({ lists, filters, onChange, showChannels = true }: { lists: Lists; filters: Filters; onChange: (f: Filters) => void; showChannels?: boolean }) {
  const brands = brandsOf(lists.domains)
  const countries = countriesOf(lists.domains)
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
      <div className="flex flex-wrap items-center gap-1.5" role="group" aria-label="Značka">
        {brands.map((b) => (
          <Chip key={b} active={filters.brands.includes(b)} onClick={() => onChange({ ...filters, brands: toggle(filters.brands, b) })} swatch={swatch(b)}>
            {b}
          </Chip>
        ))}
      </div>
      <div className="flex flex-wrap items-center gap-1" role="group" aria-label="Země">
        {countries.map((c) => (
          <Chip key={c} active={filters.countries.includes(c)} onClick={() => onChange({ ...filters, countries: toggle(filters.countries, c) })}>
            {c}
          </Chip>
        ))}
      </div>
      {showChannels && (
        <details className="relative">
          <summary className={cx('flex cursor-pointer list-none items-center gap-1 rounded-full px-3 py-1 text-xs font-medium ring-1 ring-inset', filters.channels.length ? 'bg-pink-600 text-white ring-pink-600' : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50')}>
            Kanály{filters.channels.length ? ` (${filters.channels.length})` : ''} <ChevronDown className="size-3.5" />
          </summary>
          <div className="absolute z-40 mt-2 max-h-80 w-64 overflow-y-auto rounded-xl bg-white p-2 shadow-xl ring-1 ring-slate-200">
            {lists.channels.map((c) => (
              <label key={c} className="flex cursor-pointer items-center gap-2 rounded-md px-2 py-1.5 text-sm hover:bg-slate-50">
                <input type="checkbox" className="accent-pink-600" checked={filters.channels.includes(c)} onChange={() => onChange({ ...filters, channels: toggle(filters.channels, c) })} />
                <span className="size-2.5 rounded-full" style={{ background: swatch(c).border }} />
                {c}
              </label>
            ))}
          </div>
        </details>
      )}
      <label className="relative ml-auto w-full sm:w-56">
        <Search className="pointer-events-none absolute top-2.5 left-2.5 size-4 text-slate-400" />
        <input className={`${inputClass} pl-8`} type="search" value={filters.q} onChange={(e) => onChange({ ...filters, q: e.target.value })} placeholder="Hledat…" aria-label="Hledat" />
      </label>
      {isFiltered(filters) && (
        <button type="button" onClick={() => onChange(EMPTY_FILTERS)} className="inline-flex items-center gap-1 text-xs font-medium text-slate-600 hover:text-pink-700">
          <X className="size-3.5" /> Zrušit filtry
        </button>
      )}
    </div>
  )
}
