import { useState } from 'react'
import { config } from './config'
import { mockData, type RangeKey } from './data'
import { KpiCard } from './components/KpiCard'
import { LineChart } from './components/LineChart'
import { ChannelBars } from './components/ChannelBars'
import { EmbedPanel } from './components/EmbedPanel'
import { ExternalLink } from './components/Icons'

const RANGES: { key: RangeKey; label: string }[] = [
  { key: '7d', label: '7 dní' },
  { key: '28d', label: '28 dní' },
  { key: '90d', label: '90 dní' },
]

export default function App() {
  const [range, setRange] = useState<RangeKey>('28d')
  const data = mockData[range]

  const dataConnected = Boolean(config.ga4.lookerStudioEmbedUrl || config.powerbi.embedUrl)

  return (
    <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6 lg:px-8">
      {/* Hlavička */}
      <header className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-extrabold tracking-tight text-slate-900">
            Marketingový dashboard
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            {config.brandName} · data z{' '}
            <span className="font-semibold text-[#e8710a]">GA4</span> a{' '}
            <span className="font-semibold text-[#b8960c]">Power BI</span>
          </p>
        </div>
        <div className="inline-flex rounded-xl bg-white p-1 shadow-sm ring-1 ring-slate-100">
          {RANGES.map((r) => (
            <button
              key={r.key}
              onClick={() => setRange(r.key)}
              className={`rounded-lg px-3.5 py-1.5 text-sm font-semibold transition-colors ${
                range === r.key
                  ? 'bg-brand text-white shadow-sm'
                  : 'text-slate-500 hover:text-slate-800'
              }`}
            >
              {r.label}
            </button>
          ))}
        </div>
      </header>

      {/* Upozornění na ukázková data */}
      {!dataConnected && (
        <div className="mb-6 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
          <span className="mt-0.5 text-base leading-none">⚠️</span>
          <p>
            Zobrazují se <strong>ukázková data</strong>. Reálné napojení nastavíš
            vložením odkazů na reporty do{' '}
            <code className="rounded bg-amber-100 px-1 py-0.5 text-xs">src/config.ts</code>{' '}
            (postup viz panely GA4 a Power BI níže nebo soubor README.md).
          </p>
        </div>
      )}

      {/* KPI karty */}
      <section className="mb-8 grid grid-cols-2 gap-4 md:grid-cols-3 lg:grid-cols-6">
        {data.kpis.map((k) => (
          <KpiCard key={k.label} kpi={k} />
        ))}
      </section>

      {/* Vlastní grafy z přehledových metrik */}
      <section className="mb-8 grid grid-cols-1 gap-4 lg:grid-cols-3">
        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100 lg:col-span-2">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-base font-bold text-slate-800">Vývoj návštěvnosti</h2>
            <div className="flex items-center gap-4 text-xs">
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-brand" /> Sessions
              </span>
              <span className="flex items-center gap-1.5 text-slate-500">
                <span className="h-2.5 w-2.5 rounded-full bg-brand-light" /> Uživatelé
              </span>
            </div>
          </div>
          <LineChart data={data.series} />
        </div>

        <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
          <h2 className="mb-4 text-base font-bold text-slate-800">Akviziční kanály</h2>
          <ChannelBars channels={data.channels} />
        </div>
      </section>

      {/* Embedované reporty */}
      <section className="space-y-6">
        <ReportBlock
          source="GA4"
          accent="#e8710a"
          docHref="https://lookerstudio.google.com"
          docLabel="Otevřít Looker Studio"
        >
          <EmbedPanel
            title="Google Analytics 4 report"
            url={config.ga4.lookerStudioEmbedUrl}
            accent="#e8710a"
            steps={[
              'Otevři lookerstudio.google.com a vytvoř report nad svou GA4 property.',
              'Vpravo nahoře: Share → Embed report → zapni „Enable embedding".',
              'Zkopíruj URL z atributu src="…" a vlož ji do config.ts (ga4.lookerStudioEmbedUrl).',
            ]}
          />
        </ReportBlock>

        <ReportBlock
          source="Power BI"
          accent="#b8960c"
          docHref="https://app.powerbi.com"
          docLabel="Otevřít Power BI"
        >
          <EmbedPanel
            title="Power BI report"
            url={config.powerbi.embedUrl}
            accent="#b8960c"
            steps={[
              'V Power BI Service otevři report → File → Embed report → Publish to web.',
              'Zkopíruj URL z atributu src="…" vygenerovaného iframe.',
              'Vlož ji do config.ts (powerbi.embedUrl). Pozn.: Publish to web je veřejné — pro interní data viz README.',
            ]}
          />
        </ReportBlock>
      </section>

      <footer className="mt-10 border-t border-slate-200 pt-4 text-center text-xs text-slate-400">
        Dashboard · React + Vite + Tailwind · spustíš lokálně přes{' '}
        <code className="rounded bg-slate-100 px-1 py-0.5">npm run dev</code>
      </footer>
    </div>
  )
}

function ReportBlock({
  source,
  accent,
  docHref,
  docLabel,
  children,
}: {
  source: string
  accent: string
  docHref: string
  docLabel: string
  children: React.ReactNode
}) {
  return (
    <div className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-100">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="flex items-center gap-2 text-base font-bold text-slate-800">
          <span className="h-3 w-3 rounded-sm" style={{ background: accent }} />
          {source} report
        </h2>
        <a
          href={docHref}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1.5 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          {docLabel}
          <ExternalLink className="h-3.5 w-3.5" />
        </a>
      </div>
      {children}
    </div>
  )
}
