import { swatch } from '../lib/colors'
import { domainsByBrand, splitDomain, uniq } from '../lib/model'
import { Chip, toggle } from './ui'

export function DomainPicker({ all, value, onChange }: { all: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const extra = value.filter((d) => !all.includes(d))
  return (
    <div className="space-y-2">
      {domainsByBrand([...all, ...extra]).map(([brand, ds]) => {
        const allOn = ds.every((d) => value.includes(d))
        return (
          <div key={brand} className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => onChange(allOn ? value.filter((d) => !ds.includes(d)) : uniq([...value, ...ds]))}
              className="w-28 shrink-0 text-left text-sm font-medium text-slate-700 hover:text-pink-700"
              title={allOn ? 'Odebrat všechny země' : 'Vybrat všechny země'}
            >
              {brand}
            </button>
            {ds.map((d) => (
              <Chip key={d} active={value.includes(d)} onClick={() => onChange(toggle(value, d))} swatch={swatch(brand)} title={d}>
                {splitDomain(d).country || d}
              </Chip>
            ))}
          </div>
        )
      })}
    </div>
  )
}

export function ChannelPicker({ all, value, onChange }: { all: string[]; value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {uniq([...all, ...value]).map((c) => (
        <Chip key={c} active={value.includes(c)} onClick={() => onChange(toggle(value, c))} swatch={swatch(c)}>
          {c}
        </Chip>
      ))}
    </div>
  )
}
