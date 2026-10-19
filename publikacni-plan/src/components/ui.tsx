import { X } from 'lucide-react'
import { createContext, useCallback, useContext, useEffect, useRef, useState, type ButtonHTMLAttributes, type ReactNode } from 'react'
import { type Swatch } from '../lib/colors'

const cx = (...c: (string | false | null | undefined)[]) => c.filter(Boolean).join(' ')

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-pink-600 text-white hover:bg-pink-700 shadow-sm',
  secondary: 'bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50',
  ghost: 'text-slate-600 hover:bg-slate-100',
  danger: 'bg-white text-red-700 ring-1 ring-red-200 hover:bg-red-50',
}

export function Button({ variant = 'secondary', className, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      type="button"
      {...props}
      className={cx(
        'inline-flex items-center justify-center gap-1.5 rounded-lg px-3 py-2 text-sm font-medium transition disabled:cursor-not-allowed disabled:opacity-50',
        VARIANTS[variant],
        className,
      )}
    />
  )
}

export function Chip({ active, onClick, children, swatch, title }: { active: boolean; onClick: () => void; children: ReactNode; swatch?: Swatch; title?: string }) {
  const style = active && swatch ? { background: swatch.bg, color: swatch.fg, boxShadow: `inset 0 0 0 1px ${swatch.border}` } : undefined
  return (
    <button
      type="button"
      title={title}
      aria-pressed={active}
      onClick={onClick}
      style={style}
      className={cx(
        'rounded-full px-2.5 py-1 text-xs font-medium ring-1 ring-inset transition',
        active ? (swatch ? '' : 'bg-pink-600 text-white ring-pink-600') : 'bg-white text-slate-600 ring-slate-300 hover:bg-slate-50',
      )}
    >
      {active && <span aria-hidden>✓ </span>}
      {children}
    </button>
  )
}

export function toggle<T>(list: T[], value: T): T[] {
  return list.includes(value) ? list.filter((v) => v !== value) : [...list, value]
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: [T, string][]; onChange: (v: T) => void }) {
  return (
    <div className="inline-flex rounded-lg bg-slate-100 p-0.5">
      {options.map(([v, label]) => (
        <button
          key={v}
          type="button"
          aria-pressed={value === v}
          onClick={() => onChange(v)}
          className={cx('rounded-md px-3 py-1.5 text-sm font-medium transition', value === v ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-600 hover:text-slate-900')}
        >
          {label}
        </button>
      ))}
    </div>
  )
}

/** A labelled form row. Groups of buttons (chips) get a group role instead of a <label>, so clicking the caption toggles nothing. */
export function Field({ label, children, hint, required, group }: { label: string; children: ReactNode; hint?: ReactNode; required?: boolean; group?: boolean }) {
  const caption = (
    <span className="mb-1 block text-sm font-medium text-slate-700">
      {label}
      {required && <span className="text-pink-600"> *</span>}
    </span>
  )
  const note = hint && <span className="mt-1 block text-xs text-slate-500">{hint}</span>
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
  'block w-full rounded-lg border-0 bg-white px-3 py-2 text-sm text-slate-900 ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-pink-500 focus:outline-none'

export function Modal({ title, onClose, children, footer, wide }: { title: ReactNode; onClose: () => void; children: ReactNode; footer?: ReactNode; wide?: boolean }) {
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
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-slate-900/50 p-0 backdrop-blur-sm sm:items-center sm:p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" className={cx('flex max-h-[95vh] w-full flex-col rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl', wide ? 'sm:max-w-3xl' : 'sm:max-w-2xl')}>
        <header className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button type="button" onClick={onClose} className="rounded-lg p-1 text-slate-500 hover:bg-slate-100" aria-label="Zavřít">
            <X className="size-5" />
          </button>
        </header>
        <div className="overflow-y-auto px-5 py-4">{children}</div>
        {footer && <footer className="flex flex-wrap items-center gap-2 border-t border-slate-200 px-5 py-3">{footer}</footer>}
      </div>
    </div>
  )
}

export function Badge({ swatch, children, className }: { swatch: Swatch; children: ReactNode; className?: string }) {
  return (
    <span className={cx('inline-flex items-center rounded-md px-1.5 py-0.5 text-xs font-medium whitespace-nowrap', className)} style={{ background: swatch.bg, color: swatch.fg }}>
      {children}
    </span>
  )
}

export function Spinner({ label = 'Načítám…' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-16 text-slate-500">
      <span className="size-5 animate-spin rounded-full border-2 border-slate-300 border-t-pink-600" />
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
      <div className="pointer-events-none fixed inset-x-0 bottom-4 z-[60] flex flex-col items-center gap-2 px-4" aria-live="polite">
        {toasts.map((t) => (
          <div key={t.id} className={cx('pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-2.5 text-sm font-medium text-white shadow-lg', t.kind === 'error' ? 'bg-red-600' : 'bg-slate-900')}>
            {t.text}
            {t.action && (
              <button
                type="button"
                className="rounded-md bg-white/15 px-2 py-0.5 text-xs font-semibold hover:bg-white/25"
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
    // Capture phase, so Escape closes this question and not the dialog underneath.
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
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/40 p-4" onMouseDown={(e) => e.target === e.currentTarget && answer(false)}>
          <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-message" className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
            <p id="confirm-message" className="text-sm text-slate-800">{ask.message}</p>
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
