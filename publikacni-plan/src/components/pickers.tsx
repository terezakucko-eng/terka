import { hue } from '../lib/colors'
import { domainsByBrand, splitDomain, uniq } from '../lib/model'
import { Chip, toggle } from './ui'

export function DomainPicker({ all, value, onChange }: { all: string[]; value: string[]; onChange: (v: string[]) => void }) {
  const extra = value.filter((d) => !all.includes(d))
  return (
    <div className="divide-y divide-line rounded-xl ring-1 ring-line">
      {domainsByBrand([...all, ...extra]).map(([brand, ds]) => {
        const allOn = ds.every((d) => value.includes(d))
        const someOn = ds.some((d) => value.includes(d))
        return (
          <div key={brand} className="flex flex-wrap items-center gap-1.5 px-3 py-2">
            <button
              type="button"
              onClick={() => onChange(allOn ? value.filter((d) => !ds.includes(d)) : uniq([...value, ...ds]))}
              className="mr-1 flex w-32 shrink-0 items-center gap-2 text-left text-sm font-semibold text-ink hover:text-accent"
              title={allOn ? 'Odebrat všechny země' : 'Vybrat všechny země'}
            >
              <span className="size-2.5 rounded-full" style={{ background: hue(brand), opacity: someOn ? 1 : 0.4 }} aria-hidden />
              {brand}
            </button>
            {ds.map((d) => (
              <Chip key={d} active={value.includes(d)} onClick={() => onChange(toggle(value, d))} hue={hue(brand)} title={d}>
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
        <Chip key={c} active={value.includes(c)} onClick={() => onChange(toggle(value, c))} hue={hue(c)}>
          {c}
        </Chip>
      ))}
    </div>
  )
}
