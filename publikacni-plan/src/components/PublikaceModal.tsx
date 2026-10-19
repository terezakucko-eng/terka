import { Copy, Link2, Trash2 } from 'lucide-react'
import { useState } from 'react'
import { isDemo } from '../config'
import { deletePublikace, savePublikace } from '../data/store'
import { formatRange, overlaps, yearOf } from '../lib/dates'
import { personLine } from '../lib/format'
import { type Akce, type Links, LINK_LABELS, type Lists, type Person, type PublikaceInput, statusOf } from '../lib/model'
import { ChannelPicker, DomainPicker } from './pickers'
import { Button, Field, inputClass, Sheet, StatusPill, useConfirm, useToast } from './ui'

export interface PublikaceDraft extends PublikaceInput {
  id: string | null
  createdAt?: number
  createdBy?: Person
  updatedAt?: number
  updatedBy?: Person
}

function toInput(d: PublikaceDraft): PublikaceInput {
  const input: PublikaceInput = {
    name: d.name.trim(), dateFrom: d.dateFrom, dateTo: d.dateTo, channels: d.channels, domains: d.domains,
    akceId: d.akceId, description: d.description, links: d.links, ready: d.ready,
  }
  return d.legacyId ? { ...input, legacyId: d.legacyId } : input
}

interface Props {
  draft: PublikaceDraft
  lists: Lists
  akce: Akce[]
  person: Person
  today: string
  onClose: () => void
  onDuplicate: (d: PublikaceDraft) => void
  onOpenAkce: (id: string) => void
}

export function PublikaceModal({ draft, lists, akce, person, today, onClose, onDuplicate, onOpenAkce }: Props) {
  const [d, setD] = useState<PublikaceDraft>(draft)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const toast = useToast()
  const ask = useConfirm()
  const set = <K extends keyof PublikaceDraft>(k: K, v: PublikaceDraft[K]) => setD((x) => ({ ...x, [k]: v }))
  const setLink = (k: keyof Links, v: string) => setD((x) => ({ ...x, links: { ...x.links, [k]: v } }))
  const dirty = JSON.stringify(d) !== JSON.stringify(draft)

  const close = async () => {
    if (!dirty || (await ask('Zavřít bez uložení změn?', { ok: 'Zavřít' }))) onClose()
  }

  const leaveTo = async (go: () => void) => {
    if (!dirty || (await ask('Zahodit neuložené změny publikace?', { ok: 'Zahodit' }))) go()
  }

  const nearby = akce
    .filter((a) => a.id === d.akceId || (d.dateFrom && d.dateTo && overlaps(a.dateFrom, a.dateTo, d.dateFrom, d.dateTo)))
    .sort((a, b) => a.dateFrom.localeCompare(b.dateFrom))
  const sameYear = akce.filter((a) => !nearby.includes(a) && d.dateFrom && yearOf(a.dateFrom) === yearOf(d.dateFrom))

  const save = async () => {
    const problem = !d.name.trim() ? 'Vyplň název.'
      : !d.dateFrom || !d.dateTo ? 'Vyplň datum od i do.'
      : d.dateFrom > d.dateTo ? 'Datum od je později než datum do.'
      : d.channels.length === 0 ? 'Vyber aspoň jeden kanál.'
      : null
    if (problem) return setError(problem)
    setSaving(true)
    setError(null)
    try {
      await savePublikace(toInput(d), d.id, person)
      toast(d.id ? 'Publikace uložena' : 'Publikace přidána')
      onClose()
    } catch (e) {
      setError(`Uložení se nepovedlo: ${(e as Error).message}`)
      setSaving(false)
    }
  }

  const remove = async () => {
    if (!d.id || !(await ask(`Opravdu smazat „${d.name}“?`, { ok: 'Smazat', danger: true }))) return
    await deletePublikace(d.id)
    toast('Publikace smazána')
    onClose()
  }

  const copyLink = async () => {
    const url = new URL(location.href)
    url.searchParams.set('open', `p:${d.id}`)
    try {
      await navigator.clipboard.writeText(url.toString())
      toast('Odkaz zkopírován')
    } catch {
      toast('Odkaz se nepodařilo zkopírovat, zkopíruj adresu z prohlížeče.', 'error')
    }
  }

  const status = d.dateFrom && d.dateTo ? statusOf(d, today) : null
  const meta = [personLine('Vytvořil(a)', d.createdBy, d.createdAt), personLine('Upravil(a)', d.updatedBy, d.updatedAt)].filter(Boolean)

  return (
    <Sheet
      title={d.id ? 'Publikace' : 'Nová publikace'}
      subtitle={status && d.id ? <span className="flex items-center gap-2"><StatusPill status={status} /> {formatRange(d.dateFrom, d.dateTo)}</span> : undefined}
      onClose={close}
      footer={
        <>
          {d.id && (
            <>
              <Button variant="danger" onClick={remove}><Trash2 className="size-4" /> Smazat</Button>
              <Button variant="ghost" onClick={() => onDuplicate({ ...d, id: null, ready: false, createdAt: undefined, createdBy: undefined, updatedAt: undefined, updatedBy: undefined, legacyId: undefined })}>
                <Copy className="size-4" /> Duplikovat
              </Button>
              {!isDemo && <Button variant="ghost" onClick={copyLink} title="Zkopírovat odkaz na tuto publikaci"><Link2 className="size-4" /></Button>}
            </>
          )}
          <span className="flex-1" />
          <Button onClick={close}>Zrušit</Button>
          <Button variant="primary" onClick={save} disabled={saving}>{saving ? 'Ukládám…' : 'Uložit'}</Button>
        </>
      }
    >
      <form className="space-y-5" onSubmit={(e) => (e.preventDefault(), void save())}>
        <Field label="Název" required>
          <input className={inputClass} value={d.name} onChange={(e) => set('name', e.target.value)} placeholder="např. Newsletter – Valentýn pro páry" autoFocus={!d.id} />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Od" required>
            <input type="date" className={inputClass} value={d.dateFrom} onChange={(e) => setD((x) => ({ ...x, dateFrom: e.target.value, dateTo: !x.dateTo || x.dateTo < e.target.value ? e.target.value : x.dateTo }))} />
          </Field>
          <Field label="Do" required>
            <input type="date" className={inputClass} value={d.dateTo} min={d.dateFrom} onChange={(e) => set('dateTo', e.target.value)} />
          </Field>
        </div>
        <Field label="Kanály" required group>
          <ChannelPicker all={lists.channels} value={d.channels} onChange={(v) => set('channels', v)} />
        </Field>
        <Field label="Domény" group hint="Klikni na název značky pro výběr všech jejích zemí.">
          <DomainPicker all={lists.domains} value={d.domains} onChange={(v) => set('domains', v)} />
        </Field>
        <Field label="Patří k akci z ročního plánu" group>
          <div className="flex gap-2">
            <select aria-label="Akce z ročního plánu" className={inputClass} value={d.akceId ?? ''} onChange={(e) => set('akceId', e.target.value || null)}>
              <option value="">— bez akce —</option>
              {nearby.length > 0 && (
                <optgroup label="Ve stejném termínu">
                  {nearby.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatRange(a.dateFrom, a.dateTo)})</option>)}
                </optgroup>
              )}
              {sameYear.length > 0 && (
                <optgroup label="Další akce v roce">
                  {sameYear.map((a) => <option key={a.id} value={a.id}>{a.name} ({formatRange(a.dateFrom, a.dateTo)})</option>)}
                </optgroup>
              )}
            </select>
            {d.akceId && <Button onClick={() => leaveTo(() => onOpenAkce(d.akceId!))}>Otevřít</Button>}
          </div>
        </Field>
        <Field label="Popis / poznámky">
          <textarea className={`${inputClass} min-h-28`} value={d.description} onChange={(e) => set('description', e.target.value)} placeholder="Co, pro koho, kupon, produkty, claim…" />
        </Field>
        <fieldset className="space-y-2 rounded-xl bg-raised p-3">
          <legend className="mb-1 text-xs font-semibold tracking-wide text-muted uppercase">Odkazy</legend>
          {(Object.keys(LINK_LABELS) as (keyof Links)[]).map((k) => (
            <label key={k} className="grid items-center gap-1 sm:grid-cols-[130px_1fr] sm:gap-2">
              <span className="text-[13px] text-muted">{LINK_LABELS[k]}</span>
              <span className="flex gap-1">
                <input type="url" className={inputClass} value={d.links[k]} onChange={(e) => setLink(k, e.target.value)} placeholder="https://…" />
                {d.links[k] && <a href={d.links[k]} target="_blank" rel="noreferrer" className="rounded-lg px-2 py-2 text-sm font-semibold text-accent hover:bg-accent-soft">Otevřít</a>}
              </span>
            </label>
          ))}
        </fieldset>
        <label className="flex cursor-pointer items-center gap-3 rounded-xl p-3 ring-1 ring-line hover:bg-raised/60">
          <input type="checkbox" className="size-4 accent-accent" checked={d.ready} onChange={(e) => set('ready', e.target.checked)} />
          <span className="flex-1 text-sm">
            <span className="block font-semibold text-ink">Vše připraveno</span>
            <span className="block text-xs text-muted">Texty, grafika i nastavení jsou hotové. Před startem pak stav ukazuje „Ke spuštění“.</span>
          </span>
          {status && <StatusPill status={status} />}
        </label>
        {error && <p className="rounded-lg bg-danger/10 px-3 py-2 text-sm text-danger" role="alert">{error}</p>}
        {meta.length > 0 && <p className="text-xs text-faint">{meta.join(' · ')}</p>}
        <button type="submit" className="hidden" />
      </form>
    </Sheet>
  )
}
