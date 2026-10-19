import { Download, Plus, Upload, X } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { isDemo } from '../config'
import { createMissing, readEverything, readOldApp, saveLists } from '../data/store'
import { download } from '../lib/csv'
import { significantDayId, significantDays } from '../lib/holidays'
import { type Migrated, migrateCampaign, migrateYearly, type OldCampaign, type OldYearDoc, unknownDomains } from '../lib/migrate'
import { type Akce, type AkceInput, type Lists, type Person, type PublikaceInput, SIGNIFICANT_DAY } from '../lib/model'
import { Button, inputClass, useToast } from './ui'

function Card({ title, children, description }: { title: string; description?: ReactNode; children: ReactNode }) {
  return (
    <section className="rounded-xl bg-white p-5 ring-1 ring-slate-200">
      <h2 className="text-base font-semibold text-slate-900">{title}</h2>
      {description && <p className="mt-1 text-sm text-slate-600">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  )
}

function ListEditor({ label, items, locked = [], onChange }: { label: string; items: string[]; locked?: string[]; onChange: (v: string[]) => void }) {
  const [value, setValue] = useState('')
  const add = () => {
    const v = value.trim().replace(/,/g, ' ')
    if (v && !items.includes(v)) onChange([...items, v])
    setValue('')
  }
  return (
    <div>
      <h3 className="mb-2 text-sm font-medium text-slate-700">{label} <span className="font-normal text-slate-500">{items.length}</span></h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((it) => (
          <span key={it} className="inline-flex items-center gap-1 rounded-full bg-slate-100 py-1 pr-1 pl-2.5 text-xs font-medium text-slate-700">
            {it}
            {!locked.includes(it) && (
              <button type="button" onClick={() => onChange(items.filter((x) => x !== it))} className="rounded-full p-0.5 text-slate-500 hover:bg-slate-200 hover:text-slate-800" aria-label={`Odebrat ${it}`}>
                <X className="size-3" />
              </button>
            )}
          </span>
        ))}
      </div>
      <form className="mt-2 flex max-w-md gap-2" onSubmit={(e) => (e.preventDefault(), add())}>
        <input className={inputClass} value={value} onChange={(e) => setValue(e.target.value)} placeholder="Přidat…" />
        <Button type="submit" disabled={!value.trim()}><Plus className="size-4" /> Přidat</Button>
      </form>
    </div>
  )
}

interface Preview {
  publikace: Migrated<PublikaceInput>[]
  akce: Migrated<AkceInput>[]
  skipped: number
  unknown: string[]
}

export function SettingsView({ lists, akce, person, year }: { lists: Lists; akce: Akce[]; person: Person; year: number }) {
  const toast = useToast()
  const [draft, setDraft] = useState<Lists>(lists)
  const [savingLists, setSavingLists] = useState(false)
  const [daysYear, setDaysYear] = useState(Math.max(year, new Date().getFullYear() + 1))
  const [busy, setBusy] = useState<string | null>(null)
  const [preview, setPreview] = useState<Preview | null>(null)
  const listsDirty = JSON.stringify(draft) !== JSON.stringify(lists)

  const run = async (label: string, job: () => Promise<void>) => {
    setBusy(label)
    try {
      await job()
    } catch (e) {
      toast(`${label} se nepovedlo: ${(e as Error).message}`, 'error')
    } finally {
      setBusy(null)
    }
  }

  const newDays = significantDays(daysYear).filter((n) => !akce.some((a) => a.type === SIGNIFICANT_DAY && a.name === n.name && a.dateFrom === n.dateFrom))

  const addDays = () => run('Přidání významných dnů', async () => {
    const items = newDays.map((d) => ({ id: significantDayId(d), data: d }))
    const n = await createMissing('akce', items, person)
    toast(`Přidáno ${n} významných dnů pro rok ${daysYear}`)
  })

  const loadOld = () => run('Načtení staré appky', async () => {
    const old = await readOldApp()
    const migrated = (old.campaigns as OldCampaign[]).map(migrateCampaign)
    setPreview({
      publikace: migrated.filter((m): m is Migrated<PublikaceInput> => m !== null),
      akce: migrateYearly(old.yearly as Record<string, OldYearDoc>),
      skipped: migrated.filter((m) => m === null).length,
      unknown: unknownDomains(old.campaigns as OldCampaign[]),
    })
  })

  const importOld = () => run('Import', async () => {
    if (!preview) return
    const a = await createMissing('akce', preview.akce, person)
    const p = await createMissing('publikace', preview.publikace, person)
    toast(`Importováno: ${p} publikací a ${a} akcí (už importované se přeskočily).`)
    setPreview(null)
  })

  const backup = () => run('Záloha', async () => {
    if (isDemo) return toast('V ukázce se soubory nestahují, v ostré verzi ano.')
    const data = await readEverything()
    download(`publikacni-plan-zaloha-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(data, null, 1), 'application/json')
  })

  return (
    <div className="grid gap-5 lg:grid-cols-2">
      <div className="space-y-5 lg:col-span-2">
        <Card title="Seznamy" description="Co se nabízí ve formulářích. Odebraná položka u starších záznamů zůstane, jen ji nepůjde vybrat znovu.">
          <div className="space-y-5">
            <ListEditor label="Domény (značka + země, např. „Kondomshop CZ“)" items={draft.domains} onChange={(domains) => setDraft({ ...draft, domains })} />
            <ListEditor label="Kanály" items={draft.channels} onChange={(channels) => setDraft({ ...draft, channels })} />
            <ListEditor label="Typy akcí v ročním plánu" items={draft.akceTypes} locked={[SIGNIFICANT_DAY]} onChange={(akceTypes) => setDraft({ ...draft, akceTypes })} />
          </div>
          <div className="mt-5 flex gap-2">
            <Button variant="primary" disabled={!listsDirty || savingLists} onClick={async () => {
              setSavingLists(true)
              try {
                await saveLists(draft)
                toast('Seznamy uloženy')
              } catch (e) {
                toast(`Uložení se nepovedlo: ${(e as Error).message}`, 'error')
              } finally {
                setSavingLists(false)
              }
            }}>
              Uložit seznamy
            </Button>
            {listsDirty && <Button onClick={() => setDraft(lists)}>Vrátit změny</Button>}
          </div>
        </Card>
      </div>

      <Card title="Významné dny" description="Doplní do ročního plánu svátky a dny, kolem kterých plánujete (Valentýn, Den matek podle zemí, Black Friday…). Data se dopočítají pro zvolený rok; co už v plánu je, se nepřidá znovu.">
        <div className="flex flex-wrap items-center gap-2">
          <select className={inputClass} style={{ width: '7rem' }} value={daysYear} onChange={(e) => setDaysYear(Number(e.target.value))}>
            {[0, 1, 2].map((i) => new Date().getFullYear() + i).map((y) => <option key={y}>{y}</option>)}
          </select>
          <Button variant="primary" disabled={!!busy || newDays.length === 0} onClick={addDays}>
            {newDays.length === 0 ? 'Vše už v plánu je' : `Přidat ${newDays.length} dnů`}
          </Button>
        </div>
      </Card>

      <Card title="Záloha" description="Všechny akce, publikace a nastavení v jednom souboru.">
        <Button onClick={backup} disabled={!!busy}><Download className="size-4" /> Stáhnout zálohu (JSON)</Button>
      </Card>

      <div className="lg:col-span-2">
        <Card
          title="Import ze staré appky"
          description="Načte kampaně a roční plán z rs-publikacni-plan.netlify.app a převede je sem: sjednotí zápisy domén a kanálů a vyhodí zdvojené záznamy. Import jde pustit opakovaně, co už tu je, nepřepíše."
        >
          {!preview ? (
            <Button onClick={loadOld} disabled={!!busy}><Upload className="size-4" /> {busy === 'Načtení staré appky' ? 'Načítám…' : 'Načíst data ze staré appky'}</Button>
          ) : (
            <div className="space-y-3">
              <ul className="list-inside list-disc text-sm text-slate-700">
                <li><strong>{preview.publikace.length}</strong> publikací (kampaní z kalendáře)</li>
                <li><strong>{preview.akce.length}</strong> položek ročního plánu, z toho {preview.akce.filter((a) => a.data.type === SIGNIFICANT_DAY).length} významných dnů</li>
                {preview.skipped > 0 && <li className="text-amber-700">{preview.skipped} kampaní bez názvu nebo data přeskočím</li>}
                {preview.unknown.length > 0 && <li className="text-amber-700">Neznámé domény (u kampaní zůstanou bez nich): {preview.unknown.join(', ')}</li>}
              </ul>
              <div className="flex gap-2">
                <Button variant="primary" onClick={importOld} disabled={!!busy}>{busy === 'Import' ? 'Importuji…' : 'Importovat'}</Button>
                <Button onClick={() => setPreview(null)} disabled={!!busy}>Zrušit</Button>
              </div>
            </div>
          )}
        </Card>
      </div>
    </div>
  )
}
