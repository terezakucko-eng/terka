import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { tint } from '../lib/colors'
import { STATUS, type Status } from '../lib/model'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-accent text-accent-ink hover:brightness-110 shadow-sm',
  secondary: 'bg-surface text-ink ring-1 ring-line-strong hover:bg-raised',
  ghost: 'text-muted hover:bg-raised hover:text-ink',
  danger: 'text-danger ring-1 ring-danger/30 hover:bg-danger/10',
}

export function Button({ variant = 'secondary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
    />
  )
}

/** Toggle chip; with a hue it shows a colored dot and a tinted fill when on. */
export function Chip({ active, onClick, children, hue, title }: { active: boolean; onClick: () => void; children: ReactNode; hue?: string; title?: string }) {
  const style = active ? (hue ? { background: tint(hue, 16), boxShadow: `inset 0 0 0 1px ${tint(hue, 55)}` } : undefined) : undefined
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      style={style}
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-medium transition',
        active ? (hue ? 'text-ink' : 'bg-accent text-accent-ink') : 'text-muted ring-1 ring-line ring-inset hover:bg-raised hover:text-ink',
      )}
    >
      {hue && <span className="size-2 shrink-0 rounded-full" style={{ background: hue, opacity: active ? 1 : 0.55 }} aria-hidden />}
      {children}
    </button>
  )
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: [T, string][]; onChange: (v: T) => void; label?: string }) {
  return (
    <div className="inline-flex rounded-lg bg-raised p-0.5" role="group" aria-label={label}>
      {options.map(([v, text]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cx('rounded-md px-2.5 py-1 text-[13px] font-semibold transition', value === v ? 'bg-surface text-ink shadow-sm' : 'text-muted hover:text-ink')}
        >
          {text}
        </button>
      ))}
    </div>
  )
}

/** A labelled form row. Groups of buttons (chips) get a group role instead of a <label>, so clicking the caption toggles nothing. */
export function Field({ label, children, hint, required, group }: { label: string; children: ReactNode; hint?: ReactNode; required?: boolean; group?: boolean }) {
  const caption = (
    <span className="mb-1.5 block text-xs font-semibold tracking-wide text-muted uppercase">
      {label}
      {required && <span className="text-accent"> *</span>}
    </span>
  )
  const note = hint && <span className="mt-1.5 block text-xs text-faint">{hint}</span>
  if (group) {
    return (
      <div role="group" aria-label={label}>
        {caption}
        {children}
        {note}
      </div>
    )
  }
  return (
    <label className="block">
      {caption}
      {children}
      {note}
    </label>
  )
}

export const inputClass =
  'block w-full rounded-lg border-0 bg-surface px-3 py-2 text-sm text-ink ring-1 ring-line-strong ring-inset placeholder:text-faint focus:ring-2 focus:ring-accent focus:outline-none'

/** Side sheet for editing: the plan stays visible next to it. Full screen on phones. */
export function Sheet({ title, subtitle, onClose, children, footer }: { title: ReactNode; subtitle?: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode }) {
  const close = useRef(onClose)
  useEffect(() => {
    close.current = onClose
  })
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && close.current()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])
  return (
    <div className="fade-in fixed inset-0 z-50 flex justify-end bg-ink/25" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className="sheet-in flex h-full w-full flex-col bg-surface shadow-panel sm:max-w-[560px] sm:border-l sm:border-line">
        <header className="flex items-start justify-between gap-4 border-b border-line px-5 pt-[max(1rem,env(safe-area-inset-top,0px))] pb-4">
          <div className="min-w-0">
            <h2 className="font-display text-xl font-semibold text-ink">{title}</h2>
            {subtitle && <div className="mt-1 text-sm text-muted">{subtitle}</div>}
          </div>
          <button type="button" onClick={onClose} className="rounded-lg p-1.5 text-muted hover:bg-raised hover:text-ink" aria-label="Zavřít">
            <X className="size-5" />
          </button>
        </header>
        <div className="flex-1 overflow-y-auto px-5 py-5">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-line bg-surface px-5 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">{footer}</footer>}
      </div>
    </div>
  )
}

export function StatusPill({ status, className }: { status: Status; className?: string }) {
  const { label, tone } = STATUS[status]
  return (
    <span className={cx('inline-flex items-center gap-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap', className)} style={{ color: tone, background: `color-mix(in oklab, ${tone} 13%, var(--surface))` }}>
      <span className="size-1.5 rounded-full" style={{ background: tone }} aria-hidden />
      {label}
    </span>
  )
}

/** A colored dot with a label, used for channels, brands and plan types. */
export function Tag({ hue, children, className }: { hue: string; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center gap-1.5 text-xs whitespace-nowrap text-muted', className)}>
      <span className="size-2 shrink-0 rounded-full" style={{ background: hue }} aria-hidden />
      {children}
    </span>
  )
}

export function Spinner({ label = 'Načítám…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-muted">
      <span className="size-5 animate-spin rounded-full border-2 border-line border-t-accent" />
      {label}
    </div>
  )
}

// ---------- toasty ----------

interface ToastAction {
  label: string
  run: () => void
}

interface Toast {
  id: number
  text: string
  kind: 'ok' | 'error'
  action?: ToastAction
}

const ToastContext = createContext<(text: string, kind?: Toast['kind'], action?: ToastAction) => void>(() => {})

export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: Toast['kind'] = 'ok', action?: ToastAction) => {
    const id = Date.now() + Math.random()
    setToasts((t) => [...t, { id, text, kind, action }])
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === 'error' || action ? 7000 : 3000)
  }, [])
  return (
    <ToastContext.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed inset-x-0 bottom-[max(1rem,env(safe-area-inset-bottom,0px))] z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('fade-in pointer-events-auto flex items-center gap-3 rounded-xl px-4 py-2.5 text-sm font-medium shadow-panel', t.kind === 'error' ? 'bg-danger text-white' : 'bg-ink text-surface')}>
            {t.text}
            {t.action && (
              <button
                type="button"
                className="rounded-md px-2 py-0.5 text-xs font-bold ring-1 ring-current/40 hover:bg-white/10"
                onClick={() => {
                  t.action!.run()
                  setToasts((all) => all.filter((x) => x.id !== t.id))
                }}
              >
                {t.action.label}
              </button>
            )}
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  )
}

// ---------- potvrzení ----------

interface Ask {
  message: string
  ok: string
  danger: boolean
  resolve: (v: boolean) => void
}

type ConfirmFn = (message: string, opts?: { ok?: string; danger?: boolean }) => Promise<boolean>

const ConfirmContext = createContext<ConfirmFn>(async () => false)

/** In-page yes/no question; the browser's own confirm() is blocked in embedded views. */
export const useConfirm = () => useContext(ConfirmContext)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [ask, setAsk] = useState<Ask | null>(null)
  const confirm = useCallback<ConfirmFn>(
    (message, opts = {}) => new Promise((resolve) => setAsk({ message, ok: opts.ok ?? 'Ano', danger: opts.danger ?? false, resolve })),
    [],
  )
  const answer = useCallback((v: boolean) => {
    setAsk((a) => {
      a?.resolve(v)
      return null
    })
  }, [])
  useEffect(() => {
    if (!ask) return
    // Capture phase, so Escape closes this question and not the sheet underneath.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      e.stopPropagation()
      answer(false)
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [ask, answer])
  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {ask && (
        <div className="fade-in fixed inset-0 z-[70] flex items-center justify-center bg-ink/30 p-4" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-message" className="w-full max-w-sm rounded-2xl bg-surface p-5 shadow-panel ring-1 ring-line">
            <p id="confirm-message" className="text-[15px] text-ink">{ask.message}</p>
            <div className="mt-5 flex justify-end gap-2">
              <Button onClick={() => answer(false)}>Zpět</Button>
              <Button variant={ask.danger ? 'danger' : 'primary'} onClick={() => answer(true)} autoFocus>{ask.ok}</Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export { cx }
