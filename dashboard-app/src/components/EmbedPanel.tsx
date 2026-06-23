import { Plug } from './Icons'

interface Props {
  title: string
  url: string
  accent: string // barva zdroje (GA4 / Power BI)
  steps: string[] // návod, jak odkaz získat (zobrazí se, když url chybí)
  height?: number
}

// Vykreslí embedovaný report (iframe), nebo — pokud URL chybí — návod,
// jak ho v config.ts napojit.
export function EmbedPanel({ title, url, accent, steps, height = 540 }: Props) {
  if (url) {
    return (
      <iframe
        title={title}
        src={url}
        className="w-full rounded-xl border-0 ring-1 ring-slate-200"
        style={{ height }}
        allowFullScreen
      />
    )
  }

  return (
    <div
      className="flex flex-col items-center justify-center rounded-xl border-2 border-dashed border-slate-200 bg-slate-50 px-6 text-center"
      style={{ height }}
    >
      <div
        className="mb-3 flex h-12 w-12 items-center justify-center rounded-full text-white"
        style={{ background: accent }}
      >
        <Plug className="h-6 w-6" />
      </div>
      <h3 className="text-base font-semibold text-slate-800">Zatím nenapojeno</h3>
      <p className="mt-1 max-w-md text-sm text-slate-500">
        Vlož odkaz na report do <code className="rounded bg-slate-200 px-1 py-0.5 text-xs">src/config.ts</code> a panel se sám zobrazí.
      </p>
      <ol className="mt-4 max-w-md space-y-1 text-left text-sm text-slate-600">
        {steps.map((s, i) => (
          <li key={i} className="flex gap-2">
            <span
              className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-xs font-bold text-white"
              style={{ background: accent }}
            >
              {i + 1}
            </span>
            <span>{s}</span>
          </li>
        ))}
      </ol>
    </div>
  )
}
