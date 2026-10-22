import { Plus, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { deleteAkce, saveAkce } from '../data/store'
import { hue } from '../lib/colors'
import { formatRange } from '../lib/dates'
import { personLine } from '../lib/format'
import { type AkceInput, type Links, LINK_LABELS, type Lists, type Person, type Publikace, SIGNIFICANT_DAY, uniq } from '../lib/model'
import { DomainPicker, StorePicker } from './pickers'
import { Button, Field, inputClass, Sheet, Tag, useConfirm, useToast } from './ui'

export interface AkceDraft extends AkceInput {
  id: string | null
  createdAt?: number
  createdBy?: Person
  updatedAt?: number
  updatedBy?: Person
}

function toInput(d: AkceDraft): AkceInput {
  const input: AkceInput = {
    name: d.name.trim(), type: d.type, dateFrom: d.dateFrom, dateTo: d.dateTo, domains: d.domains, stores: d.stores,
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
  const ask = useConfirm()
  const set = <K extends keyof AkceDraft>(k: K, v: AkceDraft[K]) => setD((x) => ({ ...x, [k]: v }))
  const setLink = (k: keyof Links, v: string) => setD((x) => ({ ...x, links: { ...x.links, [k]: v } }))
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)
  const linked = d.id ? publikace.filter((p) => p.akceId === d.id).sort((a, b) => a.dateFrom.localeCompare(b.dateFrom)) : []
  const isDay = d.type === SIGNIFICANT_DAY

  const close = async () => {
    if (!dirty || (await ask('Zavřít bez uložení změn?', { ok: 'Zavřít' }))) onClose()
  }

  const leaveTo = async (go: () => void) => {
    if (!dirty || (await ask('Zahodit neuložené změny akce?', { ok: 'Zahodit' }))) go()
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
    if (!(await ask(msg, { ok: 'Smazat', danger: true }))) return
    await deleteAkce(d.id, person)
    toast('Akce smazána')
    onClose()
  }

  const meta = [personLine('Vytvořil(a)', d.createdBy, d.createdAt), personLine('Upravil(a)', d.updatedBy, d.updatedAt)].filter(Boolean)

  return (
    <Sheet
      title={d.id ? (isDay ? 'Významný den' : 'Akce z ročního plánu') : 'Nová akce do ročního plánu'}
      subtitle={d.id && d.dateFrom && d.dateTo ? <span className="flex items-center gap-2"><Tag hue={hue(d.type)}>{d.type}</Tag> · {formatRange(d.dateFrom, d.dateTo)}</span> : undefined}
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
      <form className="space-y-5" onSubmit={(e) => (e.preventDefault(), void save())}>
        <div className="grid gap-3 sm:grid-cols-[1fr_190px]">
          <Field label="Název" required>
            <input className={inputClass} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="např. Black Friday 2027" autoFocus={!d.id} />
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
          <Field label="Prodejny" group hint="Jen když akce probíhá i v kamenných prodejnách.">
            <StorePicker all={lists.stores} value={d.stores} onChange={(v) => set('stores', v)} />
          </Field>
        )}
        {!isDay && (
          <Field label="Dárek / benefit">
            <input className={inputClass} value={d.benefit} onChange={(e) => set('benefit', e.target.value)} placeholder="např. Slevy až 70 %, doprava zdarma" />
          </Field>
        )}
        <Field label="Informace o akci / poznámky">
          <textarea className={`${inputClass} min-h-20`} value={d.info} onChange={(e) => set('info', e.target.value)} />
        </Field>
        {!isDay && (
          <fieldset className="space-y-2 rounded-xl bg-raised p-3">
            <legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Odkazy</legend>
            {(Object.keys(LINK_LABELS) as (keyof Links)[]).map((k) => (
              <label key={k} className="grid items-center gap-1 sm:grid-cols-[130px_1fr] sm:gap-2">
                <span className="text-[13px] text-muted">{LINK_LABELS[k]}</span>
                <input type="url" className={inputClass} value={d.links[k]} onChange={(e) => setLink(k, e.target.value)} placeholder="https://…" />
              </label>
            ))}
          </fieldset>
        )}

        <section className="rounded-xl ring-1 ring-line">
          <header className="flex items-center justify-between gap-2 border-b border-line px-3 py-2.5">
            <h3 className="text-sm font-bold text-ink">Publikace k akci <span className="font-medium text-faint">{linked.length}</span></h3>
            <Button onClick={addPublikace} disabled={saving}><Plus className="size-4" /> Přidat</Button>
          </header>
          {linked.length === 0 ? (
            <p className="px-3 py-3 text-sm text-muted">Zatím žádné. Přidej newsletter, posty, banner…</p>
          ) : (
            <ul className="divide-y divide-line/70">
              {linked.map((p) => (
                <li key={p.id}>
                  <button type="button" onClick={() => leaveTo(() => onOpenPublikace(p.id))} className="grid w-full gap-1 px-3 py-2 text-left hover:bg-raised/60 sm:grid-cols-[120px_1fr]">
                    <span className="text-xs font-semibold text-muted tabular-nums">{formatRange(p.dateFrom, p.dateTo)}</span>
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-ink">{p.name}</span>
                      <span className="mt-0.5 flex flex-wrap gap-x-3">{p.channels.map((c) => <Tag key={c} hue={hue(c)}>{c}</Tag>)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>

        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        {meta.length > 0 && <p className="text-xs text-faint">{meta.join(' · ')}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  )
}
