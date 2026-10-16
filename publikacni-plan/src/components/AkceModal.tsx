import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteAkce, saveAkce } from '../data/store'
import { swatch } from '../lib/colors'
import { formatRange } from '../lib/dates'
import { personLine } from '../lib/format'
import { type AkceInput, type Links, LINK_LABELS, type Lists, type Person, type Publikace, SIGNIFICANT_DAY, uniq } from '../lib/model'
import { DomainPicker } from './pickers'
import { Badge, Button, Field, inputClass, Modal, useToast } from './ui'

export interface AkceDraft extends AkceInput {
  id: string | null
  createdAt?: number
  createdBy?: Person
  updatedAt?: number
  updatedBy?: Person
}

function toInput(d: AkceDraft): AkceInput {
  const input: AkceInput = {
    name: d.name.trim(), type: d.type, dateFrom: d.dateFrom, dateTo: d.dateTo, domains: d.domains,
    benefit: d.benefit, info: d.info, links: d.links,
  }
  return d.legacyKey ? { ...input, legacyKey: d.legacyKey } : input
}

interface Props {
  draft: AkceDraft
  lists: Lists
  publikace: Publikace[]
  person: Person
  onClose: () => void
  onOpenPublikace: (id: string) => void
  onAddPublikace: (akceId: string, d: AkceDraft) => void
}

export function AkceModal({ draft, lists, publikace, person, onClose, onOpenPublikace, onAddPublikace }: Props) {
  const [d, setD] = useState<AkceDraft>(draft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const set = <K extends keyof AkceDraft>(k: K, v: AkceDraft[K]) => setD((x) => ({ ...x, [k]: v }))
  const setLink = (k: keyof Links, v: string) => setD((x) => ({ ...x, links: { ...x.links, [k]: v } }))
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)
  const linked = d.id ? publikace.filter((p) => p.akceId === d.id).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)) : []
  const isDay = d.type === SIGNIFICANT_DAY

  const close = () => {
    if (!dirty || confirm('Zavřít bez uložení změn?')) onClose()
  }

  const validate = () =>
    !d.name.trim() ? 'Vyplň název.'
      : !d.type ? 'Vyber typ.'
      : !d.dateFrom || !d.dateTo ? 'Vyplň datum od i do.'
      : d.dateFrom > d.dateTo ? 'Datum od je později než datum do.'
      : null

  const persist = async (): Promise<string | null> => {
    const problem = validate()
    if (problem) {
      setError(problem)
      return null
    }
    setSaving(true)
    setError(null)
    try {
      return await saveAkce(toInput(d), d.id, person)
    } catch (e) {
      setError(`Uložení se nepovedlo: ${(e as Error).message}`)
      return null
    } finally {
      setSaving(false)
    }
  }

  const save = async () => {
    const id = await persist()
    if (!id) return
    toast(d.id ? 'Akce uložena' : 'Akce přidána')
    onClose()
  }

  /** A new plan item is saved first, so the publication has something to link to. */
  const addPublikace = async () => {
    const id = d.id && !dirty ? d.id : await persist()
    if (id) onAddPublikace(id, d)
  }

  const remove = async () => {
    if (!d.id) return
    const msg = linked.length ? `Smazat „${d.name}“? ${linked.length} navázaných publikací zůstane, jen bez akce.` : `Opravdu smazat „${d.name}“?`
    if (!confirm(msg)) return
    await deleteAkce(d.id, person)
    toast('Akce smazána')
    onClose()
  }

  const meta = [personLine('Vytvořil(a)', d.createdBy, d.createdAt), personLine('Upravil(a)', d.updatedBy, d.updatedAt)].filter(Boolean)

  return (
    <Modal
      title={d.id ? (isDay ? 'Významný den' : 'Akce z ročního plánu') : 'Nová akce do ročního plánu'}
      onClose={close}
      footer={
        <>
          {d.id && <Button variant="danger" onClick={remove}><Trash2 className="size-4" /> Smazat</Button>}
          <span className="flex-1" />
          <Button onClick={close}>Zrušit</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Ukládám…' : 'Uložit'}</Button>
        </>
      }
    >
      <form className="space-y-4" onSubmit={(e) => (e.preventDefault(), void save())}>
        <div className="grid gap-3 sm:grid-cols-[1fr_200px]">
          <Field label="Název" required>
            <input className={inputClass} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="např. Black Friday 2027" autoFocus />
          </Field>
          <Field label="Typ" required>
            <select className={inputClass} value={d.type} onChange={(e) => set('type', e.target.value)}>
              {uniq([...lists.akceTypes, d.type]).filter(Boolean).map((t) => <option key={t}>{t}</option>)}
            </select>
          </Field>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Od" required>
            <input type="date" className={inputClass} value={d.dateFrom} onChange={(e) => setD((x) => ({ ...x, dateFrom: e.target.value, dateTo: !x.dateTo || x.dateTo < e.target.value ? e.target.value : x.dateTo }))} />
          </Field>
          <Field label="Do" required>
            <input type="date" className={inputClass} value={d.dateTo} min={d.dateFrom} onChange={(e) => set('dateTo', e.target.value)} />
          </Field>
        </div>
        <Field label="Domény" group hint={isDay ? 'U významného dne nech prázdné, pokud platí všude.' : 'Klikni na název značky pro výběr všech jejích zemí.'}>
          <DomainPicker all={lists.domains} value={d.domains} onChange={(v) => set('domains', v)} />
        </Field>
        {!isDay && (
          <Field label="Dárek / benefit">
            <input className={inputClass} value={d.benefit} onChange={(e) => set('benefit', e.target.value)} placeholder="např. Slevy až 70 %, doprava zdarma" />
          </Field>
        )}
        <Field label="Informace o akci / poznámky">
          <textarea className={`${inputClass} min-h-20`} value={d.info} onChange={(e) => set('info', e.target.value)} />
        </Field>
        {!isDay && (
          <fieldset className="space-y-2 rounded-xl bg-slate-50 p-3">
            <legend className="sr-only">Odkazy</legend>
            {(Object.keys(LINK_LABELS) as (keyof Links)[]).map((k) => (
              <label key={k} className="grid grid-cols-[140px_1fr] items-center gap-2">
                <span className="text-sm text-slate-600">{LINK_LABELS[k]}</span>
                <input type="url" className={inputClass} value={d.links[k]} onChange={(e) => setLink(k, e.target.value)} placeholder="https://…" />
              </label>
            ))}
          </fieldset>
        )}

        <section className="rounded-xl ring-1 ring-slate-200">
          <header className="flex items-center justify-between gap-2 border-b border-slate-200 px-3 py-2">
            <h3 className="text-sm font-semibold text-slate-800">Publikace k akci <span className="font-normal text-slate-500">{linked.length}</span></h3>
            <Button onClick={addPublikace} disabled={saving}><Plus className="size-4" /> Přidat publikaci</Button>
          </header>
          {linked.length === 0 ? (
            <p className="px-3 py-3 text-sm text-slate-500">Zatím žádné. Přidej newsletter, posty, banner…</p>
          ) : (
            <ul className="divide-y divide-slate-100">
              {linked.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => (!dirty || confirm('Zahodit neuložené změny akce?')) && onOpenPublikace(p.id)} className="flex w-full flex-wrap items-center gap-2 px-3 py-2 text-left hover:bg-slate-50">
                    <span className="w-36 text-xs text-slate-500 tabular-nums">{formatRange(p.dateFrom, p.dateTo)}</span>
                    <span className="flex-1 text-sm font-medium text-slate-800">{p.name}</span>
                    <span className="flex flex-wrap gap-1">{p.channels.map((c) => <Badge key={c} swatch={swatch(c)}>{c}</Badge>)}</span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700" role="alert">{error}</p>}
        {meta.length > 0 && <p className="text-xs text-slate-500">{meta.join(' · ')}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Modal>
  )
}
