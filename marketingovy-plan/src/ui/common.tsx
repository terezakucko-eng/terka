import React, { useEffect, useRef, useState } from 'react'
import { brandColor, brandsOf, channelGroups, groupColor, STATUS, type Lists } from '../lib/model'
import { STATUS_TONE } from '../lib/status'

/** The viewer's shell can lighten brand colours in the dark theme; the tint is mixed into the surface. */
export const vivid = (hex: string): string => `color-mix(in oklab, ${hex}, #fff var(--lift))`
export const tint = (hex: string, pct: number): string => `color-mix(in oklab, ${vivid(hex)} ${pct}%, var(--surface))`

export function BrandDots({ lists, markets }: { lists: Lists; markets: string[] }) {
  const brands = brandsOf(lists, markets)
  return (
    <span className="dots" title={markets.join(', ')}>
      {(brands.length ? brands : ['']).map((b) => <span key={b} className="dot" style={{ background: vivid(b ? brandColor(lists, b) : '#8a817d') }} />)}
    </span>
  )
}

/** A dot in the colour of a channel group; the group name is the tooltip. */
export function GroupDot({ lists, group }: { lists: Lists; group: string }) {
  return <span className="dot" title={group} style={{ background: vivid(groupColor(lists, group)) }} />
}

export function StatusPill({ status }: { status: string }) {
  return <span className={`pill ${STATUS_TONE[status] ?? 'faint'}`}>{status}</span>
}

export function Stars({ value, onChange }: { value: number | null; onChange?: (v: number | null) => void }) {
  if (!onChange) {
    return value ? <span className="stars static" title={`${value} z 5`}>{'★'.repeat(value)}<span style={{ color: 'var(--line-strong)' }}>{'★'.repeat(5 - value)}</span></span> : null
  }
  return (
    <span className="stars" role="group" aria-label="Hodnocení">
      {[1, 2, 3, 4, 5].map((n) => (
        <button key={n} type="button" aria-pressed={value != null && n <= value} aria-label={`${n} z 5`} onClick={() => onChange(value === n ? null : n)}>★</button>
      ))}
    </span>
  )
}

export function Toggle<T extends string>({ options, value, onChange, label }: { options: [T, string][]; value: T; onChange: (v: T) => void; label: string }) {
  return (
    <span className="seg" role="group" aria-label={label}>
      {options.map(([v, text]) => <button key={v} type="button" aria-pressed={value === v} onClick={() => onChange(v)}>{text}</button>)}
    </span>
  )
}

/** Brand → countries, as chips; picking is by market code. */
export function MarketPicker({ lists, value, onChange }: { lists: Lists; value: string[]; onChange: (v: string[]) => void }) {
  const brands = [...new Set(lists.markets.filter((m) => m.active || value.includes(m.code)).map((m) => m.brand))]
  const toggle = (code: string) => onChange(value.includes(code) ? value.filter((c) => c !== code) : [...value, code])
  return (
    <div className="pick">
      {brands.map((brand) => {
        const ms = lists.markets.filter((m) => m.brand === brand && (m.active || value.includes(m.code)))
        const all = ms.every((m) => value.includes(m.code))
        return (
          <div className="pick-group" key={brand}>
            <button type="button" className="chip brand" aria-pressed={all} onClick={() => onChange(all ? value.filter((c) => !ms.some((m) => m.code === c)) : [...new Set([...value, ...ms.map((m) => m.code)])])}>
              <span className="dot" style={{ background: vivid(brandColor(lists, brand)) }} />{brand}
            </button>
            {ms.map((m) => <button key={m.code} type="button" className="chip" aria-pressed={value.includes(m.code)} onClick={() => toggle(m.code)}>{m.country}</button>)}
          </div>
        )
      })}
    </div>
  )
}

/** Channels grouped like the budget; one choice when editing, several when creating. */
export function ChannelPicker({ lists, value, onChange, multiple }: { lists: Lists; value: string[]; onChange: (v: string[]) => void; multiple: boolean }) {
  const pick = (name: string) => onChange(multiple ? (value.includes(name) ? value.filter((c) => c !== name) : [...value, name]) : [name])
  const known = new Set(lists.channels.map((c) => c.name))
  const extra = value.filter((v) => v && !known.has(v))
  return (
    <div className="pick">
      {channelGroups(lists).map((group) => {
        const cs = lists.channels.filter((c) => c.group === group && (c.active || value.includes(c.name)))
        if (!cs.length) return null
        return (
          <div className="pick-group" key={group}>
            <span className="gname">{group}</span>
            {cs.map((c) => <button key={c.name} type="button" className="chip" aria-pressed={value.includes(c.name)} onClick={() => pick(c.name)}>{c.name}</button>)}
          </div>
        )
      })}
      {extra.length > 0 && (
        <div className="pick-group"><span className="gname">Jiný kanál</span>{extra.map((c) => <button key={c} type="button" className="chip" aria-pressed onClick={() => pick(c)}>{c}</button>)}</div>
      )}
    </div>
  )
}

export function Empty({ title, children }: { title: string; children?: React.ReactNode }) {
  return <div className="empty"><strong>{title}</strong>{children}</div>
}

/** Destructive actions always ask first, inside the page (the browser's own dialogs are not available). */
export function Confirm({ title, children, confirmLabel, onConfirm, onCancel, busy }: { title: string; children?: React.ReactNode; confirmLabel: string; onConfirm: () => void; onCancel: () => void; busy?: boolean }) {
  const ref = useRef<HTMLButtonElement>(null)
  useEffect(() => { ref.current?.focus() }, [])
  useEscape(onCancel)
  return (
    <div className="scrim center" role="presentation" onMouseDown={(e) => { if (e.target === e.currentTarget) onCancel() }} style={{ zIndex: 50 }}>
      <div className="dialog" role="alertdialog" aria-modal="true" aria-label={title}>
        <h2>{title}</h2>
        <div className="muted">{children}</div>
        <div className="row end">
          <button type="button" className="btn" ref={ref} onClick={onCancel}>Ne, nechat</button>
          <button type="button" className="btn danger" disabled={busy} onClick={onConfirm}>{confirmLabel}</button>
        </div>
      </div>
    </div>
  )
}

export function useEscape(fn: () => void) {
  const latest = useRef(fn)
  latest.current = fn
  useEffect(() => {
    const on = (e: KeyboardEvent) => { if (e.key === 'Escape') latest.current() }
    window.addEventListener('keydown', on)
    return () => window.removeEventListener('keydown', on)
  }, [])
}

export interface ToastMessage { id: number; text: string; error?: boolean; action?: { label: string; run: () => void } }

export function Toasts({ items, dismiss }: { items: ToastMessage[]; dismiss: (id: number) => void }) {
  return (
    <div className="toasts" role="status" aria-live="polite">
      {items.map((t) => (
        <div key={t.id} className={`toast${t.error ? ' error' : ''}`}>
          <span className="grow">{t.text}</span>
          {t.action && <button type="button" onClick={() => { t.action!.run(); dismiss(t.id) }}>{t.action.label}</button>}
          <button type="button" aria-label="Zavřít" onClick={() => dismiss(t.id)}>×</button>
        </div>
      ))}
    </div>
  )
}

export function useToasts() {
  const [items, setItems] = useState<ToastMessage[]>([])
  const counter = useRef(0)
  const dismiss = (id: number) => setItems((xs) => xs.filter((x) => x.id !== id))
  const push = (text: string, opts: { error?: boolean; action?: ToastMessage['action'] } = {}) => {
    const id = ++counter.current
    setItems((xs) => [...xs.slice(-2), { id, text, ...opts }])
    setTimeout(() => dismiss(id), opts.error ? 9000 : opts.action ? 8000 : 4500)
  }
  return { items, push, dismiss }
}

export const STATUS_OPTIONS_MANUAL = [STATUS.idea, STATUS.prep, STATUS.approved, STATUS.cancelled]

/** Reads and writes a value in the viewer's own browser; it never matters if that fails. */
export function remember(key: string, value?: string): string | null {
  try {
    if (value === undefined) return localStorage.getItem(`marketingovy-plan:${key}`)
    localStorage.setItem(`marketingovy-plan:${key}`, value)
  } catch { /* private window or blocked storage */ }
  return value ?? null
}
